package com.microboxlabs.miot.fleet.directory;

import java.time.LocalDate;

/** One asset's activity in one local day. */
public record ActivityDay(LocalDate day, int signals, int engineSeconds, int idleSeconds, int movingSeconds,
        double km) {
}
