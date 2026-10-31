package com.microboxlabs.miot.trips.dto;

/**
 * Create/patch body for a mandate. The tenant and actor never travel in the
 * body. On PATCH, null keeps the current value and "" clears it.
 */
public record MandateRequest(
        String externalCode,
        String orderType,
        String orderRef,
        String originId,
        String destinationId,
        Integer slaMinutes) {

    public static MandateRequest empty() {
        return new MandateRequest(null, null, null, null, null, null);
    }
}
