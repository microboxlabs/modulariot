package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;

/** The fields of the hot row that the trip record determines; the motor-state fields are not here. */
public record TripLiveProjection(
        String tripId,
        String tenantCode,
        String mandateCodes,
        String assetId,
        String originGeofenceLabel,
        String destinationGeofenceLabel,
        Integer originGeofenceId,
        Integer destinationGeofenceId,
        List<Integer> stopGeofenceIds,
        String status,
        String driverId,
        String driverName,
        String driverContactPhone,
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
        String typeLoad) {
}
