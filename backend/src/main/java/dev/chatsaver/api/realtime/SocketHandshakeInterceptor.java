package dev.chatsaver.api.realtime;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import dev.chatsaver.api.auth.AuthenticatedUser;

@Component
public class SocketHandshakeInterceptor implements HandshakeInterceptor {

    static final String USER_ATTRIBUTE = AuthenticatedUser.class.getName();
    private final SocketTicketService tickets;

    public SocketHandshakeInterceptor(SocketTicketService tickets) {
        this.tickets = tickets;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler handler,
            Map<String, Object> attributes) {
        String ticket = UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams()
                .getFirst("ticket");
        AuthenticatedUser user = tickets.consume(ticket).orElse(null);
        if (user == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        attributes.put(USER_ATTRIBUTE, user);
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler handler,
            Exception exception) {
    }
}
