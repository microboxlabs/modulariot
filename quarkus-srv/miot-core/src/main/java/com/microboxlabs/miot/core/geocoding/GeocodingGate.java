package com.microboxlabs.miot.core.geocoding;

/**
 * Decides whether a location resolution may call the paid geocoding provider. Only provider calls count against an
 * organization's quota: a geofence, a Plus Code, coordinates, the internal source and the cache are free. The plan
 * lives in miot-integrations; with that component off, {@link AllowAllGeocodingGate} allows every call. Blocking.
 */
public interface GeocodingGate {

    /**
     * @param organization the org slug, or null when the caller has none
     * @param tenantCode   the tenant the site belongs to
     * @return null when the provider may be called, else why not
     */
    Refusal checkProviderCall(String organization, String tenantCode);

    /**
     * Why the provider was not called. {@code code} is stable for clients to translate; {@code message} is the note
     * the site keeps while it waits for review.
     */
    record Refusal(String code, String message) {
    }
}
