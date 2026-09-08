package com.microboxlabs.miot.core.branding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;

class DomainNameTest {

    @Test
    void lowercasesAndTrims() {
        assertEquals("portal.example.com", DomainName.normalize("  Portal.Example.COM "));
    }

    @Test
    void stripsPortSoAHostHeaderMatchesTheStoredDomain() {
        assertEquals("localhost", DomainName.normalize("localhost:3050"));
    }

    @Test
    void stripsTrailingDot() {
        assertEquals("example.com", DomainName.normalize("example.com."));
    }

    @Test
    void acceptsHyphensInsideLabels() {
        assertEquals("my-host.example.com", DomainName.normalize("my-host.example.com"));
    }

    @Test
    void rejectsBlank() {
        assertThrows(BadRequestException.class, () -> DomainName.normalize("   "));
        assertThrows(BadRequestException.class, () -> DomainName.normalize(null));
    }

    @Test
    void rejectsAPathSoTheKeyStaysAHostname() {
        assertThrows(BadRequestException.class,
                () -> DomainName.normalize("example.com/app"));
    }

    @Test
    void rejectsASchemePrefix() {
        assertThrows(BadRequestException.class,
                () -> DomainName.normalize("https://example.com"));
    }

    @Test
    void rejectsEmptyLabels() {
        assertThrows(BadRequestException.class, () -> DomainName.normalize("a..b"));
        assertThrows(BadRequestException.class, () -> DomainName.normalize(".example.com"));
    }

    @Test
    void rejectsLabelsEdgedWithHyphens() {
        assertThrows(BadRequestException.class, () -> DomainName.normalize("-bad.example.com"));
        assertThrows(BadRequestException.class, () -> DomainName.normalize("bad-.example.com"));
    }

    @Test
    void rejectsNamesLongerThanDnsAllows() {
        String tooLong = ("a".repeat(63) + ".").repeat(4) + "a";
        assertThrows(BadRequestException.class, () -> DomainName.normalize(tooLong));
    }

    @Test
    void rejectsLabelsLongerThanDnsAllows() {
        String labelTooLong = "a".repeat(64) + ".example.com";

        assertThrows(BadRequestException.class, () -> DomainName.normalize(labelTooLong));
    }
}
