package com.microboxlabs.miot.core.vehicle;

import java.time.Instant;
import java.util.Optional;

/**
 * Studio images of vehicles by make, model and year. The organization's own image provider is used first, then the
 * platform's. Blocking.
 */
public interface VehicleImages {

    /** What to look for. {@code model}, {@code year}, {@code view} and {@code width} are optional. */
    record Query(String make, String model, Integer year, String view, Integer width) {
    }

    /** A URL the browser can load until {@code expiresAt}. */
    record Image(String url, Instant expiresAt) {
    }

    /** Empty when no provider is configured, the vehicle is unknown, or the provider fails. */
    Optional<Image> find(String tenantCode, Query query);
}
