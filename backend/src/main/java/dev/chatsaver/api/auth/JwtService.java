package dev.chatsaver.api.auth;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

@Service
public class JwtService {

    private final String issuer;
    private final byte[] secret;
    private final Duration accessTokenTtl;

    public JwtService(
            @Value("${chatsaver.auth.issuer}") String issuer,
            @Value("${chatsaver.auth.secret}") String secret,
            @Value("${chatsaver.auth.access-token-minutes}") long accessTokenMinutes) {
        this.issuer = issuer;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.accessTokenTtl = Duration.ofMinutes(accessTokenMinutes);
        if (this.secret.length < 32) {
            throw new IllegalArgumentException("JWT secret must contain at least 32 UTF-8 bytes.");
        }
    }

    public AccessToken issue(UUID userId, UUID deviceId, String email) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(accessTokenTtl);
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .subject(userId.toString())
                .claim("device_id", deviceId.toString())
                .claim("email", email)
                .issueTime(Date.from(issuedAt))
                .expirationTime(Date.from(expiresAt))
                .jwtID(UUID.randomUUID().toString())
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        try {
            jwt.sign(new MACSigner(secret));
            return new AccessToken(jwt.serialize(), expiresAt);
        } catch (JOSEException exception) {
            throw new IllegalStateException("Access token signing failed.", exception);
        }
    }

    public Optional<AuthenticatedUser> parse(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!JWSAlgorithm.HS256.equals(jwt.getHeader().getAlgorithm())
                    || !jwt.verify(new MACVerifier(secret))) {
                return Optional.empty();
            }
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            Date expiration = claims.getExpirationTime();
            if (!issuer.equals(claims.getIssuer())
                    || expiration == null
                    || !expiration.toInstant().isAfter(Instant.now())) {
                return Optional.empty();
            }
            return Optional.of(new AuthenticatedUser(
                    UUID.fromString(claims.getSubject()),
                    UUID.fromString(claims.getStringClaim("device_id")),
                    claims.getStringClaim("email")));
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    public record AccessToken(String value, Instant expiresAt) {
    }
}
