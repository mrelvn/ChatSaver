package dev.chatsaver.api.sync;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import dev.chatsaver.api.auth.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Validated
@RestController
@RequestMapping("/api/v1/sync")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @PostMapping("/push")
    PushResponse push(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody PushRequest request) {
        return new PushResponse(syncService.push(user, request.mutations()));
    }

    @GetMapping("/snapshot")
    SyncService.VaultSnapshot snapshot(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "0") long after) {
        return syncService.snapshot(user, after);
    }

    @DeleteMapping("/vault")
    ResponseEntity<Void> eraseVault(@AuthenticationPrincipal AuthenticatedUser user) {
        syncService.eraseVault(user.userId());
        return ResponseEntity.noContent().build();
    }

    record PushRequest(@NotEmpty @Size(max = 100) List<@Valid Mutation> mutations) {
    }

    public record Mutation(
            @NotNull UUID id,
            @NotBlank String entityType,
            @NotNull UUID entityId,
            @NotBlank String operation,
            @NotNull Map<String, Object> payload) {
    }

    record PushResponse(int accepted) {
    }
}
