package com.microboxlabs.miot.core.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PlatformAuthorizerTest {

    @Test
    void ownerMatchIsCaseAndWhitespaceInsensitive() {
        Set<String> owners = PlatformAuthorizer.normalizeOwners(
                List.of("  Owner@Example.com ", "second@example.com"));

        assertTrue(PlatformAuthorizer.isOwner(owners, "owner@example.com"));
        assertTrue(PlatformAuthorizer.isOwner(owners, " OWNER@EXAMPLE.COM "));
        assertTrue(PlatformAuthorizer.isOwner(owners, "second@example.com"));
    }

    @Test
    void nonOwnersAreDenied() {
        Set<String> owners = PlatformAuthorizer.normalizeOwners(List.of("owner@example.com"));

        assertFalse(PlatformAuthorizer.isOwner(owners, "someone@example.com"));
        assertFalse(PlatformAuthorizer.isOwner(owners, null));
    }

    @Test
    void anUnconfiguredOwnerListDeniesEveryone() {
        assertFalse(PlatformAuthorizer.isOwner(
                PlatformAuthorizer.normalizeOwners(List.of()), "owner@example.com"));
        assertFalse(PlatformAuthorizer.isOwner(
                PlatformAuthorizer.normalizeOwners(null), "owner@example.com"));
    }

    @Test
    void blankEntriesAreDroppedRatherThanMatchingABlankEmail() {
        Set<String> owners = PlatformAuthorizer.normalizeOwners(
                List.of("  ", "owner@example.com"));

        assertEquals(1, owners.size());
        assertFalse(PlatformAuthorizer.isOwner(owners, "   "));
    }
}
