package com.microboxlabs.miot.core.branding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;

class HomeUrlTest {

    @Test
    void keepsHttpAndHttpsUrls() {
        assertEquals("https://example.com/", HomeUrl.normalize("  https://example.com/  "));
        assertEquals("http://example.com", HomeUrl.normalize("http://example.com"));
    }

    @Test
    void absentValueMeansNoLink() {
        assertNull(HomeUrl.normalize(null));
        assertNull(HomeUrl.normalize("   "));
    }

    @Test
    void rejectsJavascriptUrlsWhichWouldRunOnTheSignInPage() {
        assertThrows(BadRequestException.class,
                () -> HomeUrl.normalize("javascript:alert(1)"));
        assertThrows(BadRequestException.class,
                () -> HomeUrl.normalize("JaVaScRiPt:alert(1)"));
    }

    @Test
    void rejectsDataUrls() {
        assertThrows(BadRequestException.class,
                () -> HomeUrl.normalize("data:text/html,<script>alert(1)</script>"));
    }

    @Test
    void rejectsSchemeRelativeAndRelativeUrls() {
        assertThrows(BadRequestException.class, () -> HomeUrl.normalize("//example.com"));
        assertThrows(BadRequestException.class, () -> HomeUrl.normalize("/app/home"));
    }

    @Test
    void rejectsHttpUrlsWithNoHost() {
        assertThrows(BadRequestException.class, () -> HomeUrl.normalize("https:///path"));
    }

    @Test
    void rejectsUrlsCarryingCredentialsOrASpoofedAuthority() {
        assertThrows(BadRequestException.class,
                () -> HomeUrl.normalize("https://user:password@example.com"));
        assertThrows(BadRequestException.class,
                () -> HomeUrl.normalize("https://www.trusted.example@evil.example"));
    }

    @Test
    void rejectsOverlyLongUrls() {
        String tooLong = "https://example.com/" + "a".repeat(2048);

        assertThrows(BadRequestException.class, () -> HomeUrl.normalize(tooLong));
    }
}
