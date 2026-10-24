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

    public static final String ANNOUNCED = "anunciada";
    public static final String READY = "lista";
    public static final String PICKED = "retirada";
    public static final String DELIVERED = "entregada";
    public static final String RECEIVED = "recibida";
    public static final String REJECTED = "rechazada";
}
