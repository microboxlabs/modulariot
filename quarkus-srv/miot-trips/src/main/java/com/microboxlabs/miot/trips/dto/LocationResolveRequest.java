package com.microboxlabs.miot.trips.dto;

import io.quarkus.runtime.annotations.RegisterForReflection;

/**
 * One site to locate. {@code locationId} picks an existing location; otherwise {@code externalCode} finds or creates
 * it, and without either a new one is created from {@code name} and {@code type}. {@code districtCode} is the
 * Peruvian ubigeo or the Chilean commune code; {@code country} is ISO 3166 alpha-2.
 */
@RegisterForReflection
public record LocationResolveRequest(
        String locationId,
        String externalCode,
        String name,
        String type,
        String address,
        String country,
        String districtCode,
        String district,
        String plusCode,
        Double latitude,
        Double longitude) {
}
