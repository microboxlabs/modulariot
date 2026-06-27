package com.microboxlabs.miot.conversational.persistence;

import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

/**
 * A blank or non-UUID conversation id must short-circuit to {@code null} before any DB
 * access, so an invalid path param surfaces as 404 rather than a 500 from
 * {@code UUID.fromString}. The guard runs before {@code client()}, so a null pool is safe.
 */
class ConversationRepositoryTest {

    private final ConversationRepository repository = new ConversationRepository(null);

    @Test
    void findByTenantAndIdReturnsNullForBlankId() {
        assertNull(repository.findByTenantAndId("tenant", "  "));
    }

    @Test
    void findByTenantAndIdReturnsNullForNonUuidId() {
        assertNull(repository.findByTenantAndId("tenant", "not-a-uuid"));
    }
}
