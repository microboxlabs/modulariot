package com.microboxlabs.miot.trips.dto;

import io.quarkus.runtime.annotations.RegisterForReflection;

/** One site of a batch: the location, or the error that stopped it. */
@RegisterForReflection
public record LocationResolveResult(int index, LocationView location, String error) {
}
