package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;

/** One asset's activity in one UTC hour, computed from its GPS signals. */
public record ActivityHour(String assetId, Instant hour, int signals, int engineSeconds, int idleSeconds,
        int movingSeconds, double km) {
}
