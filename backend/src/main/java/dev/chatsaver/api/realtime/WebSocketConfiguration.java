package dev.chatsaver.api.realtime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfiguration implements WebSocketConfigurer {

    private final VaultSocketHandler handler;
    private final SocketHandshakeInterceptor handshakeInterceptor;
    private final String webOrigin;

    public WebSocketConfiguration(
            VaultSocketHandler handler,
            SocketHandshakeInterceptor handshakeInterceptor,
            @Value("${chatsaver.web-origin:http://localhost:3000}") String webOrigin) {
        this.handler = handler;
        this.handshakeInterceptor = handshakeInterceptor;
        this.webOrigin = webOrigin;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/sync")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOrigins(webOrigin);
    }
}
