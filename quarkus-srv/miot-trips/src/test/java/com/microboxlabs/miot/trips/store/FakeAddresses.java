package com.microboxlabs.miot.trips.store;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Chilean street addresses held in memory, keyed as openaddresses stores them. */
public class FakeAddresses implements InternalAddresses {

    private final Map<String, Point> byKey = new HashMap<>();

    public FakeAddresses add(String commune, String street, String number, double lon, double lat) {
        byKey.put(commune + "|" + street + "|" + number, new Point(lon, lat));
        return this;
    }

    @Override
    public boolean supports(String country) {
        return "CL".equals(country);
    }

    @Override
    public Optional<Point> find(String country, List<String> communes, List<String> streets, String number) {
        for (String c : communes) {
            for (String s : streets) {
                Point p = byKey.get(c + "|" + s + "|" + number);
                if (p != null) {
                    return Optional.of(p);
                }
            }
        }
        return Optional.empty();
    }
}
