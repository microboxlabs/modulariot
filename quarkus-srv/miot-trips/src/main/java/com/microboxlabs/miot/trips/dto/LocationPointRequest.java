package com.microboxlabs.miot.trips.dto;

/** A point set by hand: a Plus Code or coordinates, and the district when it changes. */
public record LocationPointRequest(
        String country,
        String districtCode,
        String district,
        String plusCode,
        Double latitude,
        Double longitude) {
}
