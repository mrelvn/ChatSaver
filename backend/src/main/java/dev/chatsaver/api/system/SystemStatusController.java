package dev.chatsaver.api.system;

import java.time.Instant;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/system")
public class SystemStatusController {

    @GetMapping("/status")
    SystemStatusResponse status() {
        return new SystemStatusResponse("ok", "chatsaver-api", Instant.now());
    }

    record SystemStatusResponse(String status, String service, Instant timestamp) {
    }
}

