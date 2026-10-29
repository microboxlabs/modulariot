package com.microboxlabs.miot.trips.dto;

/** One site of a batch: the location, or the error that stopped it. */
public record LocationResolveResult(int index, LocationView location, String error) {
}
