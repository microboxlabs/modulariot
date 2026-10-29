package com.microboxlabs.miot.integrations.orgaccount;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.Date;
import java.net.URI;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class PlatformGoogleTokenTest {

    @Test
    void loadsTheCredentialsOnceAndAnswersTheirToken() {
        AtomicInteger loads = new AtomicInteger();
        PlatformGoogleToken token = new PlatformGoogleToken(() -> {
            loads.incrementAndGet();
            return new GoogleCredentials(GoogleCredentials.newBuilder().setQuotaProjectId("quota-demo")) {
                @Override
                public AccessToken refreshAccessToken() {
                    return new AccessToken("ya29.platform", new Date(System.currentTimeMillis() + 3_600_000));
                }
            };
        });
        URI uri = URI.create("https://iamcredentials.googleapis.com/");
        assertEquals(List.of("Bearer ya29.platform"), token.metadata(uri).get("Authorization"));
        assertEquals(List.of("quota-demo"), token.metadata(uri).get("x-goog-user-project"));
        assertEquals(1, loads.get());
    }

    @Test
    void reportsMissingCredentials() {
        PlatformGoogleToken token = new PlatformGoogleToken(() -> {
            throw new IOException("Your default credentials were not found");
        });
        URI uri = URI.create("https://iamcredentials.googleapis.com/");
        GoogleCallException error = assertThrows(GoogleCallException.class, () -> token.metadata(uri));
        assertEquals("The platform has no usable Google credentials", error.getMessage());
        assertEquals("Your default credentials were not found", error.getCause().getMessage());
    }
}
