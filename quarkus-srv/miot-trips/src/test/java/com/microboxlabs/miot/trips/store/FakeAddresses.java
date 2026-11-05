package com.microboxlabs.miot.trips.store;

import java.util.ArrayList;
import java.util.List;

/** Chilean street addresses held in memory, spelled as openaddresses stores them. */
public class FakeAddresses implements InternalAddresses {

    private record Entry(String commune, String street, String number, Point point) {
    }

    private final List<Entry> entries = new ArrayList<>();

    public FakeAddresses add(String commune, String street, String number, double lon, double lat) {
        entries.add(new Entry(commune, street, number, new Point(lon, lat)));
        return this;
    }

    @Override
    public boolean supports(String country) {
        return "CL".equals(country);
    }

    @Override
    public List<Candidate> numbered(String country, List<String> communes, String number, int limit) {
        return entries.stream()
                .filter(e -> e.number().equals(number) && (communes.isEmpty() || communes.contains(e.commune())))
                .limit(limit).map(e -> new Candidate(e.commune(), e.street(), e.point())).toList();
    }
}
