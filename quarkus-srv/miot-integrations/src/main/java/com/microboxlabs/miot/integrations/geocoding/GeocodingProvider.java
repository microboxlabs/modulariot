package com.microboxlabs.miot.integrations.geocoding;

import java.io.IOException;
import java.net.URI;
import java.util.List;

/** One forward geocoding API. The token comes from the connection and never leaves the server. */
public interface GeocodingProvider {

    /** {@code country} is ISO 3166-1 alpha-2; {@code locality} is the district or commune, or null. */
    record Query(String address, String locality, String country) {
    }

    /** {@code addressLevel}: the result is a street number or a building, not a street, a city or a region. */
    record Candidate(double lon, double lat, String type, boolean addressLevel, String label) {
    }

    /** As stored on the connection's {@code metadata.provider} and in usage rows. */
    String name();

    URI baseUrl();

    /** Only the configured host: the token is sent to no other. */
    default boolean serves(URI url) {
        return url != null && baseUrl().getHost().equalsIgnoreCase(url.getHost())
                && baseUrl().getScheme().equalsIgnoreCase(url.getScheme())
                && baseUrl().getPort() == url.getPort();
    }

    /** Whether the provider's terms allow keeping this connection's results. */
    boolean storable(GeocodingConnection connection);

    /** Best match first; empty when the provider found nothing. */
    List<Candidate> forward(GeocodingConnection connection, Query query) throws IOException, InterruptedException;

    /** The query text: the address, then the locality when the address does not name it. */
    static String text(Query query) {
        String address = query.address() == null ? "" : query.address().strip();
        String locality = query.locality() == null ? "" : query.locality().strip();
        if (locality.isEmpty() || address.toLowerCase().contains(locality.toLowerCase())) {
            return address;
        }
        return address.isEmpty() ? locality : address + ", " + locality;
    }
}
