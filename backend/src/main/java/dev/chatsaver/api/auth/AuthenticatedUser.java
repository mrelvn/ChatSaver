package dev.chatsaver.api.auth;

import java.util.UUID;

public record AuthenticatedUser(
        UUID userId,
        UUID deviceId,
        String email) {
}
