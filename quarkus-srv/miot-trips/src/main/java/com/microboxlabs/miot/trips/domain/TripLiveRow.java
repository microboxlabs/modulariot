package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;

/** The hot projection of a trip — same shape as live_trip; the motor writes the motor-state fields. */
public record TripLiveRow(
        String tripId,
        String tenantCode,
        String mandateCodes,
        String assetId,
        String tripType,
        Integer originGeofenceId,
        Integer destinationGeofenceId,
        String originGeofenceLabel,
        String destinationGeofenceLabel,
        List<Integer> stopGeofenceIds,
        String status,
        String driverId,
        String driverName,
        String driverContactPhone,
        boolean doubleDriver,
        String secondDriverId,
        String secondDriverName,
        String secondDriverContactPhone,
        String carrierId,
        String carrierName,
        String carrierContactPhone,
        String ramplaPlate,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        OffsetDateTime estimatedArrivalTime,
        String typeLoad,
        Integer currentGeofenceId,
        boolean originVisited,
        boolean destinationVisited,
        Boolean originIsInternal,
        List<String> forwardId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
