package dev.chatsaver.api.realtime;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.chatsaver.api.auth.AuthenticatedUser;

@RestController
@RequestMapping("/api/v1/realtime")
public class SocketTicketController {

    private final SocketTicketService tickets;

    public SocketTicketController(SocketTicketService tickets) {
        this.tickets = tickets;
    }

    @PostMapping("/socket-ticket")
    SocketTicketService.IssuedTicket issue(
            @AuthenticationPrincipal AuthenticatedUser user) {
        return tickets.issue(user);
    }
}
