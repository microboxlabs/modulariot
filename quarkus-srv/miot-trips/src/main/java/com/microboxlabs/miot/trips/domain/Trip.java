package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/** One leg of transport (tramo propio); may serve one or more mandates. */
public record Trip(
        String id,
        String tenantCode,
        String status,
        String originId,
        String destinationId,
        OffsetDateTime plannedStart,
        OffsetDateTime actualStart,
        OffsetDateTime actualEnd,
        String cancelReason,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String PLANNED = "planificado";
    public static final String EN_ROUTE = "en_ruta";
    public static final String DONE = "realizado";
    public static final String CANCELLED = "anulado";
}
