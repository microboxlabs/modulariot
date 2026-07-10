package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * UUID guards must short-circuit before {@code client()} so unit tests with a null pool are safe.
 */
class GpsWebhookSubscriptionRepositoryTest {

    private final GpsWebhookSubscriptionRepository repository = new GpsWebhookSubscriptionRepository(null);
    private final WebhookDeliveryRepository deliveryRepository = new WebhookDeliveryRepository(null);

    @Test
    void findByTenantAndIdReturnsNullForBlankId() {
        assertNull(repository.findByTenantAndId("tenant", "  "));
    }

    @Test
    void findByTenantAndIdReturnsNullForNonUuid() {
        assertNull(repository.findByTenantAndId("tenant", "not-a-uuid"));
    }

    @Test
    void softDeleteReturnsFalseForNonUuid() {
        assertFalse(repository.softDelete("tenant", "bad"));
    }

    @Test
    void listDeliveriesReturnsEmptyForNonUuid() {
        assertTrue(deliveryRepository.listBySubscription("tenant", "bad", 10).isEmpty());
    }
}
