package com.microboxlabs.miot.trips.dto;

import java.math.BigDecimal;

/** Announce/patch body for a cargo unit; null keeps, "" clears where it applies. */
public record CargoRequest(
        String description,
        BigDecimal qty,
        String qtyUnit,
        BigDecimal weightKg,
        BigDecimal volumeM3,
        String status) {

    public static CargoRequest empty() {
        return new CargoRequest(null, null, null, null, null, null);
    }
}
