package com.microboxlabs.miot.fleet.resources.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.store.ResourceStore;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class FleetResourcesServiceTest {

    private static final String ACTIVE_ID = UUID.randomUUID().toString();

    private static Carrier carrier(String id, String name, String status) {
        return new Carrier(id, "t1", null, "76.111.222-8", name, null, null, null, "+56900000001", null, status,
                false, null, null, null, null, null, null);
    }

    /** A store whose active carrier list returns {@code carriers} and records the query it got. */
    private static ResourceStore store(List<Carrier> carriers, String[] query) {
        return (ResourceStore) Proxy.newProxyInstance(ResourceStore.class.getClassLoader(),
                new Class<?>[] {ResourceStore.class}, (proxy, method, args) -> {
                    if (method.getName().equals("listActiveCarriers")) {
                        query[0] = (String) args[1];
                        return carriers;
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
    }

    @Test
    void normalizesOnlyAsciiLettersAndDigitsBeforeUppercasing() {
        assertEquals("ABC123", FleetResourcesService.key("abc-123").orElseThrow());
        assertEquals("12", FleetResourcesService.key("ı-12").orElseThrow());
        assertTrue(FleetResourcesService.key("ı - ").isEmpty());
        assertTrue(FleetResourcesService.key(null).isEmpty());
    }

    @Test
    void searchesTheTenantsActiveCarriers() {
        String[] query = new String[1];
        FleetResourcesService service = new FleetResourcesService(store(List.of(
                carrier(ACTIVE_ID, "Transportes Sur", Carrier.ACTIVE)), query));

        List<FleetResources.Carrier> found = service.carriers("t1", " trans ", 8);

        assertEquals("trans", query[0]);
        assertEquals(List.of(new FleetResources.Carrier(UUID.fromString(ACTIVE_ID), "Transportes Sur", "+56900000001",
                "76.111.222-8")), found);
    }

    @ParameterizedTest
    @ValueSource(strings = {"truck", "trailer", "driver"})
    void knownIncludesInactiveResourcesButRequiresTheRightTenantTypeAndId(String type) {
        UUID id = UUID.randomUUID();
        ResourceStore directory = (ResourceStore) Proxy.newProxyInstance(ResourceStore.class.getClassLoader(),
                new Class<?>[] {ResourceStore.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "isCurrent" -> false;
                    case "vehicle" -> "test".equals(args[0]) && type.equals(args[1]) && id.equals(args[2])
                            ? Optional.of(new FleetResources.Vehicle("TEST-PLATE-1", null)) : Optional.empty();
                    case "driverSummary" -> "test".equals(args[0]) && "driver".equals(type) && id.equals(args[1])
                            ? Optional.of(new FleetResources.Driver("TEST-DOCUMENT-1", "Test Driver", null))
                            : Optional.empty();
                    default -> throw new UnsupportedOperationException(method.getName());
                });
        FleetResourcesService service = new FleetResourcesService(directory);

        assertFalse(service.exists("test", type, id), "manual assignments still require an active resource");
        assertTrue(service.known("test", type, id));
        assertFalse(service.known("other-test-tenant", type, id));
        assertFalse(service.known("test", type, UUID.randomUUID()));
        assertFalse(service.known("test", "truck".equals(type) ? "trailer" : "truck", id));
    }
}
