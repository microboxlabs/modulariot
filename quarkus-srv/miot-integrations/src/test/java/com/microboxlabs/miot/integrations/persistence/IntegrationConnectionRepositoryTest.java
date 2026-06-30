package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

/**
 * A blank or non-UUID connection id must short-circuit to {@code null} before any DB
 * access, so a malformed path param surfaces as 404 (get / test / patch) rather than a 500
 * from {@code UUID.fromString}. The guard runs before {@code client()}, so a null pool is safe.
 */
class IntegrationConnectionRepositoryTest {

    private final IntegrationConnectionRepository repository = new IntegrationConnectionRepository(null);

    @Test
    void findByTenantAndIdReturnsNullForBlankId() {
        assertNull(repository.findByTenantAndId("tenant", "  "));
    }

    @Test
    void findByTenantAndIdReturnsNullForNonUuidId() {
        assertNull(repository.findByTenantAndId("tenant", "not-a-uuid"));
    }

    @Test
    void findActiveWhatsAppByPhoneNumberIdReturnsNullForBlankPhoneNumberId() {
        assertNull(repository.findActiveWhatsAppByPhoneNumberId("  "));
    }

    @Test
    void findActiveWhatsAppByPhoneNumberIdReturnsNullForNullPhoneNumberId() {
        assertNull(repository.findActiveWhatsAppByPhoneNumberId(null));
    }
}
