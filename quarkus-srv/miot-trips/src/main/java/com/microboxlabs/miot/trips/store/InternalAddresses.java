package com.microboxlabs.miot.trips.store;

import java.util.List;

/** Street addresses with their points, held by the platform. */
public interface InternalAddresses {

    record Point(double lon, double lat) {
    }

    /** One address: its commune and street as the source spells them. */
    record Candidate(String commune, String street, Point point) {
    }

    boolean supports(String country);

    /**
     * The addresses with this house number, in one of {@code communes} (spellings of one commune) or, when it is
     * empty, anywhere in the country; at most {@code limit}, in the source's order. The caller compares the streets.
     */
    List<Candidate> numbered(String country, List<String> communes, String number, int limit);
}
