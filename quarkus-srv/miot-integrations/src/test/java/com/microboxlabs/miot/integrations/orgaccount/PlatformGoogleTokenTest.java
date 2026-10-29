package com.microboxlabs.miot.integrations.orgaccount;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.Date;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class PlatformGoogleTokenTest {

    @Test
    void loadsTheCredentialsOnceAndAnswersTheirToken() {
        AtomicInteger loads = new AtomicInteger();
        PlatformGoogleToken token = new PlatformGoogleToken(() -> {
            loads.incrementAndGet();
            return GoogleCredentials.create(new AccessToken("ya29.platform",
                    new Date(System.currentTimeMillis() + 3_600_000)));
        });
        assertEquals("ya29.platform", token.get());
        assertEquals("ya29.platform", token.get());
        assertEquals(1, loads.get());
    }

    @Test
    void reportsMissingCredentials() {
        PlatformGoogleToken token = new PlatformGoogleToken(() -> {
            throw new IOException("Your default credentials were not found");
        });
        GoogleCallException error = assertThrows(GoogleCallException.class, token::get);
        assertTrue(error.getMessage().contains("not found"));
    }
}
