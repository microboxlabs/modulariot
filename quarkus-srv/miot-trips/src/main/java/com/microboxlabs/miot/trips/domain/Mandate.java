package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/** The order header a mandante places; its code is unique per tenant. */
public record Mandate(
        String id,
        String tenantCode,
        String externalCode,
        String orderType,
        String orderRef,
        String status,
        String originId,
        String destinationId,
        Integer slaMinutes,
        OffsetDateTime closedAt,
        String cancelReason,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String ACTIVE = "active";
    public static final String RUNNING = "in_progress";
    public static final String CLOSED = "closed";
    public static final String CANCELLED = "cancelled";
}
