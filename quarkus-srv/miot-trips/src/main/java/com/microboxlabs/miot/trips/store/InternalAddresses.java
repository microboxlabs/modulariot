package com.microboxlabs.miot.trips.store;

import java.util.List;
import java.util.Optional;

/** Street addresses with their points, held by the platform. */
public interface InternalAddresses {

    record Point(double lon, double lat) {
    }

    boolean supports(String country);

    /** The address whose commune, street and number equal one of the spellings given; empty when none does. */
    Optional<Point> find(String country, List<String> communes, List<String> streets, String number);
}
