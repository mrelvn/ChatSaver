package dev.chatsaver.api.note;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import dev.chatsaver.api.auth.AuthenticatedUser;
import dev.chatsaver.api.note.NoteQueryRepository.NotePage;
import dev.chatsaver.api.note.NoteQueryRepository.NoteView;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

@Validated
@RestController
@RequestMapping("/api/v1/notes")
public class NoteQueryController {

    private final NoteQueryRepository notes;

    public NoteQueryController(NoteQueryRepository notes) {
        this.notes = notes;
    }

    @GetMapping
    NotePage list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "ALL") NoteView view,
            @RequestParam(defaultValue = "") @Size(max = 200) String query,
            @RequestParam(required = false) @Size(max = 500) String cursor,
            @RequestParam(defaultValue = "30") @Min(1) @Max(100) int limit) {
        return notes.findPage(user.userId(), query, view, cursor, limit);
    }
}
