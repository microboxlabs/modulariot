package com.microboxlabs.miot.teltonika.device;

import java.time.Instant;
import java.time.OffsetDateTime;

/**
 * The asset (license plate) a device reported for during a period ({@code miot_teltonika.device_assignment}).
 * {@code validUntil} null means open.
 */
public record Assignment(String imei, String assetId, OffsetDateTime validFrom, OffsetDateTime validUntil,
        OffsetDateTime createdAt, String createdBy) {

    public boolean covers(Instant time) {
        return !time.isBefore(validFrom.toInstant())
                && (validUntil == null || time.isBefore(validUntil.toInstant()));
    }

    public boolean open() {
        return validUntil == null;
    }
}
