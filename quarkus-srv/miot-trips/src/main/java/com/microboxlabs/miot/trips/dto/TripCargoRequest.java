package com.microboxlabs.miot.trips.dto;

/** Mounts a cargo unit on a trip, with the stages where it loads and unloads when known. */
public record TripCargoRequest(String cargoId, String loadStageId, String unloadStageId) {
}
