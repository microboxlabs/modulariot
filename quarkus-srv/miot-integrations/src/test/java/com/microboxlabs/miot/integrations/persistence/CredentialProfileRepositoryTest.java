package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * A blank or non-UUID id must short-circuit to {@code null} before any DB access, so an
 * invalid credential-profile reference can't reach the pool. The guards run before
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

    @Test
    void findReturnsNullForNonUuidId() {
        assertNull(repository.findByTenantAndId("tenant", "not-a-uuid"));
    }

    @Test
    void updateReturnsNullForNonUuidId() {
        assertNull(repository.update(new UpdateCredentialProfileParams(
                "tenant", "not-a-uuid", "name", "QA", null, null, null, "someone@example.com")));
    }

    @Test
    void updateTestResultReturnsNullForNonUuidId() {
        assertNull(repository.updateTestResult("tenant", "not-a-uuid", OffsetDateTime.now(), true));
    }

    @Test
    void softDeleteReportsNothingDeletedForNonUuidId() {
        assertFalse(repository.softDelete("tenant", "not-a-uuid", "someone@example.com"));
    }

    /**
     * The usage lookup is the same story from the other side: an empty id set must not
     * reach the pool either, since a credential nobody references costs no query.
     */
    @Test
    void usageLookupSkipsTheQueryForAnEmptyIdSet() {
        IntegrationConnectionRepository connections = new IntegrationConnectionRepository(null);

        assertTrue(connections.listByCredentialProfiles("tenant", List.of()).isEmpty());
        assertTrue(connections.listByCredentialProfiles("tenant", null).isEmpty());
    }
}
