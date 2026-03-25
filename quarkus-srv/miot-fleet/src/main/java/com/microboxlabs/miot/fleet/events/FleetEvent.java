package com.microboxlabs.miot.fleet.events;

import java.time.Instant;

public record FleetEvent(
        String type,
        Long vehicleId,
        Instant timestamp,
        String payload
) {
    public static final String CHANNEL = "fleet.events";
}
