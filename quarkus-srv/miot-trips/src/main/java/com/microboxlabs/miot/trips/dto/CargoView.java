package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.CargoUnit;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** A cargo unit as the API serves it. */
public record CargoView(
        String id,
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
        OffsetDateTime updatedAt) {

    public static CargoView of(CargoUnit c) {
        return new CargoView(c.id(), c.lineId(), c.partialNo(), c.description(), c.qty(), c.qtyUnit(),
                c.weightKg(), c.volumeM3(), c.status(), c.receiptResult(), c.receiptNotes(), c.receivedAt(),
                c.createdAt(), c.updatedAt());
    }
}
