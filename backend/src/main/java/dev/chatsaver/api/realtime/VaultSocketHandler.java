package dev.chatsaver.api.realtime;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import dev.chatsaver.api.auth.AuthenticatedUser;

@Component
public class VaultSocketHandler extends TextWebSocketHandler {

    private final ConcurrentHashMap<UUID, Set<WebSocketSession>> sessions =
            new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        AuthenticatedUser user = user(session);
        if (user == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }
        sessions.computeIfAbsent(user.userId(), ignored -> ConcurrentHashMap.newKeySet())
                .add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        remove(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        remove(session);
        if (session.isOpen()) session.close(CloseStatus.SERVER_ERROR);
    }

    public void publish(UUID userId, UUID sourceDeviceId, long cursor) {
        Set<WebSocketSession> userSessions = sessions.get(userId);
        if (userSessions == null || userSessions.isEmpty()) return;

        TextMessage message = new TextMessage(
                "{\"type\":\"vault.changed\",\"cursor\":" + cursor
                        + ",\"occurredAt\":\"" + Instant.now() + "\"}");

        for (WebSocketSession session : userSessions) {
            AuthenticatedUser connectedUser = user(session);
            if (connectedUser == null || connectedUser.deviceId().equals(sourceDeviceId)) continue;
            try {
                synchronized (session) {
                    if (session.isOpen()) session.sendMessage(message);
                }
            } catch (IOException exception) {
                remove(session);
            }
        }
    }

    private void remove(WebSocketSession session) {
        AuthenticatedUser user = user(session);
        if (user == null) return;
        sessions.computeIfPresent(user.userId(), (ignored, userSessions) -> {
            userSessions.remove(session);
            return userSessions.isEmpty() ? null : userSessions;
        });
    }

    private static AuthenticatedUser user(WebSocketSession session) {
        Object value = session.getAttributes().get(SocketHandshakeInterceptor.USER_ATTRIBUTE);
        return value instanceof AuthenticatedUser user ? user : null;
    }
}
