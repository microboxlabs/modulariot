package com.microboxlabs.miot.integrations.geocoding;

import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import java.math.BigDecimal;

/**
 * A {@code GEOCODING} connection as the providers read it. The credential holds the token as {@code token}. The
 * metadata holds {@code provider} ({@code mapbox} by default or {@code google}), {@code permanent} (Mapbox, true by
 * default) and {@code costPerRequestUsd}, the price of one call.
 */
public record GeocodingConnection(String connectionId, String provider, String token, boolean permanent,
        BigDecimal costPerRequest) {

    public static final String PROVIDER = "provider";
    public static final String TOKEN = "token";
    public static final String PERMANENT = "permanent";
    public static final String COST = "costPerRequestUsd";

    /** @throws IllegalArgumentException when the cost is not a number */
    static GeocodingConnection of(ResolvedConnection c) {
        String provider = c.metadataString(PROVIDER);
        String permanent = c.metadataString(PERMANENT);
        String cost = c.metadataString(COST);
        return new GeocodingConnection(c.connectionId(),
                provider == null || provider.isBlank() ? MapboxGeocoding.NAME : provider.strip().toLowerCase(),
                c.secretString(TOKEN), permanent == null || Boolean.parseBoolean(permanent.strip()),
                cost == null || cost.isBlank() ? null : new BigDecimal(cost.strip()));
    }
}
