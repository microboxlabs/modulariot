package com.microboxlabs.miot.fleet.directory;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

/** Fictional fleet for dev mode and tests: two carriers, trucks, trailers and a decoy GPS. */
public class DemoFleetData implements FleetData {

    static final String ANDES = "Transportes Andes (demo)";
    static final String PACIFICO = "Transportes Pacífico (demo)";
    private static final String AUSTRAL = "GPS Austral (demo)";
    private static final String NORTE = "Rastreo Norte (demo)";
    private static final String PORT = "Puerto (demo)";
    private static final String PLANT = "Planta (demo)";
    private static final String DEPOT = "Centro de distribución (demo)";

    private final Supplier<Instant> clock;

    public DemoFleetData(Supplier<Instant> clock) {
        this.clock = clock;
    }

    @Override
    public List<AssetFacts> assets(Set<String> clientIds) {
        Instant now = clock.get();
        Instant fresh = now.minus(Duration.ofMinutes(1));
        TripView open = trip("D-1001", PLANT, PORT, "SCHEDULED", now.minus(Duration.ofHours(3)), null,
                now.plus(Duration.ofHours(2)), ANDES, "Carlos Muñoz", "DEMO-JX1");
        TripView planned = trip("D-1002", DEPOT, PLANT, "ADDED", now.plus(Duration.ofHours(14)), null,
                now.plus(Duration.ofHours(18)), ANDES, "Pedro Rojas", null);
        TripView late = trip("D-1003", DEPOT, PORT, "ADDED", now.plus(Duration.ofHours(4)), null,
                now.plus(Duration.ofHours(8)), PACIFICO, "Mario Díaz", null);
        return List.of(
                facts("DEMO-TR1", "Truck", 2022, fresh, -33.45, -70.95, 78.0, true, AUSTRAL, open, null, 23, 96.0,
                        new Share(ANDES, 23, 23), new Share("DEMO-JX1", 14, 23), new Share("Carlos Muñoz", 19, 23),
                        new Share(PLANT, 15, 23)),
                facts("DEMO-JX1", "Jaula", 2019, fresh, -33.45, -70.95, 78.0, null, AUSTRAL, open, null, 21, 90.0,
                        new Share(ANDES, 21, 21), null, null, new Share(PLANT, 14, 21)),
                facts("DEMO-TR2", "Truck", 2021, now.minus(Duration.ofMinutes(3)), -33.36, -70.74, 0.0, false,
                        AUSTRAL, null, planned, 18, 70.5, new Share(ANDES, 18, 18), new Share("DEMO-JX2", 6, 18),
                        new Share("Pedro Rojas", 17, 18), new Share(DEPOT, 12, 18)),
                facts("DEMO-TR3", "CAMION", 2020, now.minus(Duration.ofMinutes(2)), -33.52, -70.70, 0.0, false,
                        NORTE, null, null, 12, 41.0, new Share(PACIFICO, 12, 12), null, new Share("Luis Soto", 7, 12),
                        new Share(DEPOT, 9, 12)),
                facts("DEMO-TR4", "Truck", 2018, now.minus(Duration.ofHours(31)), -33.60, -70.80, 0.0, false,
                        NORTE, null, late, 4, 12.0, new Share(PACIFICO, 4, 4), null, null, null),
                facts("DEMO-JX2", "Rampla plana", null, now.minus(Duration.ofHours(6)), -33.36, -70.74, 0.0, null,
                        NORTE, null, null, 7, 25.0, new Share(PACIFICO, 7, 7), null, null, new Share(DEPOT, 5, 7)),
                facts("DEMO-SEN1", "Señuelo", null, fresh, -33.45, -70.95, 78.0, null, NORTE, open, null, 9, 30.0,
                        null, null, null, null));
    }

    @Override
    public List<TripView> plannedTrips(String assetId) {
        Instant now = clock.get();
        return assetId.startsWith("DEMO-TR") ? List.of(
                trip("D-2001", PORT, DEPOT, "ADDED", now.plus(Duration.ofHours(20)), null,
                        now.plus(Duration.ofHours(24)), ANDES, "Carlos Muñoz", null)) : List.of();
    }

    @Override
    public List<TripView> recentTrips(String assetId, int limit) {
        Instant now = clock.get().truncatedTo(ChronoUnit.HOURS);
        List<TripView> trips = new ArrayList<>();
        for (int i = 1; i <= Math.min(limit, 6); i++) {
            Instant start = now.minus(Duration.ofDays(i)).minus(Duration.ofHours(6));
            trips.add(trip("D-09" + i, i % 2 == 0 ? DEPOT : PLANT, PORT, "CLOSED", start,
                    start.plus(Duration.ofHours(3 + i % 3)), start.plus(Duration.ofHours(4)), ANDES, "Carlos Muñoz",
                    null));
        }
        return trips;
    }

    @Override
    public List<ActivityHour> activity(Instant from, Instant to) {
        List<ActivityHour> hours = new ArrayList<>();
        for (Instant h = from; h.isBefore(to); h = h.plus(1, ChronoUnit.HOURS)) {
            int hourOfDay = h.atZone(java.time.ZoneOffset.UTC).getHour();
            boolean working = hourOfDay >= 10 && hourOfDay < 22;
            if (working) {
                hours.add(new ActivityHour("DEMO-TR1", h, 60, 3300, 300, 3000, 62.5));
                hours.add(new ActivityHour("DEMO-TR2", h, 55, 2700, 600, 2100, 41.0));
            }
        }
        return hours;
    }

    private static TripView trip(String id, String origin, String destination, String status, Instant start,
            Instant end, Instant eta, String carrier, String driver, String trailer) {
        return new TripView(id, origin, destination, status, start, end, eta, carrier, driver, trailer);
    }

    private static AssetFacts facts(String id, String type, Integer year, Instant signalAt, double lat, double lon,
            double speed, Boolean engineOn, String provider, TripView current, TripView next, int trips,
            double tripHours, Share carrier, Share trailer, Share driver, Share origin) {
        return new AssetFacts(id, type, year, signalAt, lat, lon, speed, engineOn, provider, "demo-client",
                driver == null ? null : driver.value(), current, next, trips, tripHours, carrier, trailer, driver,
                origin);
    }
}
