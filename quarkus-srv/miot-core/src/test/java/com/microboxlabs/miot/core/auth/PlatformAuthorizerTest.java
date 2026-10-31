package com.microboxlabs.miot.core.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.smallrye.mutiny.Uni;
import java.util.List;
import java.util.Optional;
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

    @Test
    void aDisabledUserIsNoPlatformOwner() {
        StatusAuthorizer authorizer = new StatusAuthorizer(List.of("boot@example.com"));
        authorizer.assigned = Set.of("assigned@example.com", "off@example.com");
        authorizer.disabled = Set.of("off@example.com", "boot@example.com");

        assertTrue(owner(authorizer, "assigned@example.com"));
        assertFalse(owner(authorizer, "off@example.com"));
        assertFalse(owner(authorizer, "boot@example.com"));
        assertFalse(owner(authorizer, "nobody@example.com"));
    }

    @Test
    void aConfiguredOwnerStaysOneWhenTheDatabaseCannotBeRead() {
        StatusAuthorizer authorizer = new StatusAuthorizer(List.of("boot@example.com"));
        authorizer.databaseDown = true;

        assertTrue(owner(authorizer, "boot@example.com"));
    }

    private static boolean owner(PlatformAuthorizer authorizer, String email) {
        return authorizer.isPlatformOwner(email).await().indefinitely();
    }

    /** Owner assignments and disabled users in memory. */
    private static final class StatusAuthorizer extends PlatformAuthorizer {
        Set<String> assigned = Set.of();
        Set<String> disabled = Set.of();
        boolean databaseDown;

        StatusAuthorizer(List<String> configured) {
            super(Optional.of(configured), null);
        }

        @Override
        protected Uni<Boolean> hasOwnerAssignment(String email) {
            return Uni.createFrom().item(assigned.contains(email));
        }

        @Override
        protected Uni<Boolean> accountActive(String email) {
            return databaseDown
                    ? Uni.createFrom().failure(new IllegalStateException("database down"))
                    : Uni.createFrom().item(!disabled.contains(email));
        }
    }
}
