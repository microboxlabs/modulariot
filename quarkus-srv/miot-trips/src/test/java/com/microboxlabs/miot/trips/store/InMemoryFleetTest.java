package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class InMemoryFleetTest {
    @Test
    void activeDuplicateWinsRegardlessOfInsertionOrder() {
        InMemoryFleet fleet = new InMemoryFleet();
        UUID truck = fleet.add("truck", "ABC-123", true);
        fleet.add("truck", "abc 123", false);
        assertEquals(truck, fleet.byPlate("test", "truck", "ABC123").orElseThrow().id());
        fleet.add("driver", "123-456", false);
        UUID driver = fleet.add("driver", "123456", true);
        assertEquals(driver, fleet.driverByDocument("test", "123.456").orElseThrow().id());
    }
}
