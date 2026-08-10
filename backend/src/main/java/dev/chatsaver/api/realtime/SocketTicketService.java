package dev.chatsaver.api.realtime;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import dev.chatsaver.api.auth.AuthenticatedUser;

@Service
public class SocketTicketService {

    private static final Duration TICKET_TTL = Duration.ofSeconds(30);
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();

    public IssuedTicket issue(AuthenticatedUser user) {
        Instant now = Instant.now();
        tickets.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
        String value = UUID.randomUUID().toString();
        Instant expiresAt = now.plus(TICKET_TTL);
        tickets.put(value, new Ticket(user, expiresAt));
        return new IssuedTicket(value, expiresAt);
    }

    public Optional<AuthenticatedUser> consume(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        Ticket ticket = tickets.remove(value);
        if (ticket == null || !ticket.expiresAt().isAfter(Instant.now())) return Optional.empty();
        return Optional.of(ticket.user());
    }

    public record IssuedTicket(String ticket, Instant expiresAt) {
    }

    private record Ticket(AuthenticatedUser user, Instant expiresAt) {
    }
}
