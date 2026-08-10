package dev.chatsaver.api.system;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SystemStatusControllerTest {

    @Test
    void reportsServiceAsAvailable() {
        var response = new SystemStatusController().status();

        assertThat(response.status()).isEqualTo("ok");
        assertThat(response.service()).isEqualTo("chatsaver-api");
        assertThat(response.timestamp()).isNotNull();
    }
}

