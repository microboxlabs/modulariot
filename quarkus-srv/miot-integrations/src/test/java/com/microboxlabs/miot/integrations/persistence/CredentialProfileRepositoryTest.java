package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

/**
 * A blank or non-UUID id must short-circuit to {@code null} before any DB access, so an
 * invalid credential-profile reference can't reach the pool. The guard runs before
 * {@code client()}, so a null pool is safe.
 */
class CredentialProfileRepositoryTest {

    private final CredentialProfileRepository repository = new CredentialProfileRepository(null);

    @Test
    void updateSecretReturnsNullForBlankId() {
        assertNull(repository.updateSecret("tenant", "  ", "enc", "****"));
    }

    @Test
    void updateSecretReturnsNullForNonUuidId() {
        assertNull(repository.updateSecret("tenant", "not-a-uuid", "enc", "****"));
    }
}
