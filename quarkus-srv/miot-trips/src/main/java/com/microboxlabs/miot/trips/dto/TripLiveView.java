package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.trips.domain.TripLiveRow;
import java.time.OffsetDateTime;
import java.util.List;

/** A hot row as the API serves it — read-only; the registry and the motor write it. */
public record TripLiveView(
        String tripId,
        JsonNode mandateCodes,
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

    public static TripLiveView of(TripLiveRow r) {
        return new TripLiveView(r.tripId(), Jsons.node(r.mandateCodes()), r.assetId(), r.tripType(),
                r.originGeofenceId(), r.destinationGeofenceId(), r.originGeofenceLabel(),
                r.destinationGeofenceLabel(), r.stopGeofenceIds(), r.status(), r.driverId(), r.driverName(),
                r.driverContactPhone(), r.doubleDriver(), r.secondDriverId(), r.secondDriverName(),
                r.secondDriverContactPhone(), r.carrierId(), r.carrierName(), r.carrierContactPhone(),
                r.ramplaPlate(), r.startTime(), r.endTime(), r.estimatedArrivalTime(), r.typeLoad(),
                r.currentGeofenceId(), r.originVisited(), r.destinationVisited(), r.originIsInternal(),
                r.forwardId(), r.createdAt(), r.updatedAt());
    }
}
