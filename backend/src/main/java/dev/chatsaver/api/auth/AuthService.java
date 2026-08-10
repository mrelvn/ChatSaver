package dev.chatsaver.api.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import dev.chatsaver.api.auth.JwtService.AccessToken;

@Service
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int REFRESH_TOKEN_BYTES = 32;
    private static final int BCRYPT_MAX_BYTES = 72;

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final Duration refreshTokenTtl;

    public AuthService(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            @Value("${chatsaver.auth.refresh-token-days}") long refreshTokenDays) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenTtl = Duration.ofDays(refreshTokenDays);
    }

    @Transactional
    public Session register(
            String email,
            String password,
            String displayName,
            UUID deviceId,
            String deviceName) {
        String normalizedEmail = normalizeEmail(email);
        validatePasswordBytes(password);
        if (findUserByEmail(normalizedEmail).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account already uses this email.");
        }

        UUID userId = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO app_user (id, email, display_name, password_hash)
                    VALUES (?, ?, ?, ?)
                    """, userId, normalizedEmail, cleanDisplayName(displayName), passwordEncoder.encode(password));
            jdbc.update("""
                    INSERT INTO device (id, user_id, name, last_seen_at)
                    VALUES (?, ?, ?, now())
                    """, deviceId, userId, cleanDeviceName(deviceName));
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The account or device already exists.",
                    exception);
        }

        UserRow user = findUserById(userId).orElseThrow();
        return issueSession(user, deviceId, UUID.randomUUID());
    }

    @Transactional
    public Session login(String email, String password, UUID deviceId, String deviceName) {
        String normalizedEmail = normalizeEmail(email);
        validatePasswordBytes(password);
        UserRow user = findUserByEmail(normalizedEmail)
                .filter(candidate -> candidate.passwordHash() != null)
                .filter(candidate -> passwordEncoder.matches(password, candidate.passwordHash()))
                .orElseThrow(AuthService::unauthorized);

        registerOrTouchDevice(user.id(), deviceId, deviceName);
        jdbc.update("""
                UPDATE refresh_session
                SET revoked_at = now()
                WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL
                """, user.id(), deviceId);
        return issueSession(user, deviceId, UUID.randomUUID());
    }

    @Transactional
    public Session refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw unauthorized();
        }

        String tokenHash = hashToken(rawRefreshToken);
        RefreshRow current = lockRefreshSession(tokenHash).orElseThrow(AuthService::unauthorized);
        if (current.rotatedAt() != null || current.revokedAt() != null) {
            jdbc.update("""
                    UPDATE refresh_session
                    SET revoked_at = coalesce(revoked_at, now())
                    WHERE family_id = ?
                    """, current.familyId());
            throw unauthorized();
        }
        if (!current.expiresAt().isAfter(Instant.now())) {
            jdbc.update("UPDATE refresh_session SET revoked_at = now() WHERE id = ?", current.id());
            throw unauthorized();
        }

        UserRow user = findUserById(current.userId()).orElseThrow(AuthService::unauthorized);
        ensureActiveDevice(current.deviceId(), current.userId());

        RefreshToken replacement = createRefreshToken(
                current.userId(),
                current.deviceId(),
                current.familyId());
        jdbc.update("""
                UPDATE refresh_session
                SET rotated_at = now(), replaced_by = ?
                WHERE id = ?
                """, replacement.id(), current.id());
        touchDevice(current.deviceId());

        AccessToken accessToken = jwtService.issue(user.id(), current.deviceId(), user.email());
        return new Session(user.toPublicUser(), accessToken, replacement.rawValue(), replacement.expiresAt());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        jdbc.update("""
                UPDATE refresh_session
                SET revoked_at = coalesce(revoked_at, now())
                WHERE token_hash = ?
                """, hashToken(rawRefreshToken));
    }

    private Session issueSession(UserRow user, UUID deviceId, UUID familyId) {
        RefreshToken refreshToken = createRefreshToken(user.id(), deviceId, familyId);
        AccessToken accessToken = jwtService.issue(user.id(), deviceId, user.email());
        return new Session(user.toPublicUser(), accessToken, refreshToken.rawValue(), refreshToken.expiresAt());
    }

    private RefreshToken createRefreshToken(UUID userId, UUID deviceId, UUID familyId) {
        byte[] tokenBytes = new byte[REFRESH_TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(tokenBytes);
        String rawValue = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        Instant expiresAt = Instant.now().plus(refreshTokenTtl);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO refresh_session
                    (id, user_id, device_id, token_hash, family_id, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, userId, deviceId, hashToken(rawValue), familyId, Timestamp.from(expiresAt));
        return new RefreshToken(id, rawValue, expiresAt);
    }

    private Optional<RefreshRow> lockRefreshSession(String tokenHash) {
        List<RefreshRow> matches = jdbc.query("""
                SELECT id, user_id, device_id, family_id, expires_at, rotated_at, revoked_at
                FROM refresh_session
                WHERE token_hash = ?
                FOR UPDATE
                """, AuthService::mapRefreshRow, tokenHash);
        return matches.stream().findFirst();
    }

    private void registerOrTouchDevice(UUID userId, UUID deviceId, String deviceName) {
        List<DeviceRow> devices = jdbc.query("""
                SELECT user_id, revoked_at
                FROM device
                WHERE id = ?
                """, (resultSet, rowNumber) -> new DeviceRow(
                        resultSet.getObject("user_id", UUID.class),
                        nullableInstant(resultSet, "revoked_at")), deviceId);
        if (devices.isEmpty()) {
            jdbc.update("""
                    INSERT INTO device (id, user_id, name, last_seen_at)
                    VALUES (?, ?, ?, now())
                    """, deviceId, userId, cleanDeviceName(deviceName));
            return;
        }
        DeviceRow device = devices.getFirst();
        if (!userId.equals(device.userId()) || device.revokedAt() != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This device identifier cannot be used for this session.");
        }
        jdbc.update("""
                UPDATE device
                SET name = ?, last_seen_at = now()
                WHERE id = ?
                """, cleanDeviceName(deviceName), deviceId);
    }

    private void ensureActiveDevice(UUID deviceId, UUID userId) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*)
                FROM device
                WHERE id = ? AND user_id = ? AND revoked_at IS NULL
                """, Integer.class, deviceId, userId);
        if (count == null || count != 1) {
            throw unauthorized();
        }
    }

    private void touchDevice(UUID deviceId) {
        jdbc.update("UPDATE device SET last_seen_at = now() WHERE id = ?", deviceId);
    }

    private Optional<UserRow> findUserByEmail(String email) {
        List<UserRow> matches = jdbc.query("""
                SELECT id, email, display_name, password_hash
                FROM app_user
                WHERE email = ? AND deleted_at IS NULL
                """, AuthService::mapUserRow, email);
        return matches.stream().findFirst();
    }

    private Optional<UserRow> findUserById(UUID id) {
        List<UserRow> matches = jdbc.query("""
                SELECT id, email, display_name, password_hash
                FROM app_user
                WHERE id = ? AND deleted_at IS NULL
                """, AuthService::mapUserRow, id);
        return matches.stream().findFirst();
    }

    private static UserRow mapUserRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new UserRow(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("email"),
                resultSet.getString("display_name"),
                resultSet.getString("password_hash"));
    }

    private static RefreshRow mapRefreshRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new RefreshRow(
                resultSet.getObject("id", UUID.class),
                resultSet.getObject("user_id", UUID.class),
                resultSet.getObject("device_id", UUID.class),
                resultSet.getObject("family_id", UUID.class),
                nullableInstant(resultSet, "expires_at"),
                nullableInstant(resultSet, "rotated_at"),
                nullableInstant(resultSet, "revoked_at"));
    }

    private static Instant nullableInstant(ResultSet resultSet, String column) throws SQLException {
        Timestamp timestamp = resultSet.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String cleanDisplayName(String displayName) {
        String cleaned = displayName == null ? "" : displayName.trim();
        return cleaned.isBlank() ? null : cleaned;
    }

    private static String cleanDeviceName(String deviceName) {
        String cleaned = deviceName == null ? "" : deviceName.trim();
        return cleaned.isBlank() ? "Web browser" : cleaned;
    }

    private static void validatePasswordBytes(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password must be at most 72 UTF-8 bytes.");
        }
    }

    private static String hashToken(String rawToken) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials or session.");
    }

    public record Session(
            PublicUser user,
            AccessToken accessToken,
            String refreshToken,
            Instant refreshTokenExpiresAt) {
    }

    public record PublicUser(UUID id, String email, String displayName) {
    }

    private record UserRow(UUID id, String email, String displayName, String passwordHash) {
        PublicUser toPublicUser() {
            return new PublicUser(id, email, displayName);
        }
    }

    private record DeviceRow(UUID userId, Instant revokedAt) {
    }

    private record RefreshRow(
            UUID id,
            UUID userId,
            UUID deviceId,
            UUID familyId,
            Instant expiresAt,
            Instant rotatedAt,
            Instant revokedAt) {
    }

    private record RefreshToken(UUID id, String rawValue, Instant expiresAt) {
    }
}
