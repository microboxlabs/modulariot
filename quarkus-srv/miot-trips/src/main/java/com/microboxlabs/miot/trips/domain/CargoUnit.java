package com.microboxlabs.miot.trips.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** The indivisible unit of delivery: a partial of a mandate line. */
public record CargoUnit(
        String id,
        String tenantCode,
        String lineId,
        int partialNo,
        String description,
        BigDecimal qty,
        String qtyUnit,
        BigDecimal weightKg,
        BigDecimal volumeM3,
        String status,
        String receiptResult,
        String receiptNotes,
        OffsetDateTime receivedAt,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String ANNOUNCED = "announced";
    public static final String READY = "ready";
    public static final String PICKED = "picked_up";
    public static final String DELIVERED = "delivered";
    public static final String RECEIVED = "received";
    public static final String REJECTED = "rejected";
}
