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
    private static final String CLIENT = "demo-client";
    private static final String CARLOS = "Carlos Muñoz";
    private static final String PEDRO = "Pedro Rojas";
    private static final String LUIS = "Luis Soto";
    private static final String JX1 = "DEMO-JX1";
    private static final String TRUCK = "Truck";
    private static final String ADDED = "ADDED";

    private final Supplier<Instant> clock;

    public DemoFleetData(Supplier<Instant> clock) {
        this.clock = clock;
    }

    @Override
    public List<AssetFacts> assets(Set<String> clientIds) {
        Instant now = clock.get();
        Instant fresh = now.minus(Duration.ofMinutes(1));
        TripView open = new TripView("D-1001", PLANT, PORT, "SCHEDULED", now.minus(Duration.ofHours(3)), null,
                now.plus(Duration.ofHours(2)), ANDES, CARLOS, JX1);
        TripView planned = new TripView("D-1002", DEPOT, PLANT, ADDED, now.plus(Duration.ofHours(14)), null,
                now.plus(Duration.ofHours(18)), ANDES, PEDRO, null);
        TripView late = new TripView("D-1003", DEPOT, PORT, ADDED, now.plus(Duration.ofHours(4)), null,
                now.plus(Duration.ofHours(8)), PACIFICO, "Mario Díaz", null);
        return List.of(
                new AssetFacts("DEMO-TR1", TRUCK, 2022, fresh, -33.45, -70.95, 78.0, true, AUSTRAL, CLIENT, CARLOS,
                        open, null, 23, 96.0, new Share(ANDES, 23, 23), new Share(JX1, 14, 23),
                        new Share(CARLOS, 19, 23), new Share(PLANT, 15, 23)),
                new AssetFacts(JX1, "Jaula", 2019, fresh, -33.45, -70.95, 78.0, null, AUSTRAL, CLIENT, null, open,
                        null, 21, 90.0, new Share(ANDES, 21, 21), null, null, new Share(PLANT, 14, 21)),
                new AssetFacts("DEMO-TR2", TRUCK, 2021, now.minus(Duration.ofMinutes(3)), -33.36, -70.74, 0.0, false,
                        AUSTRAL, CLIENT, PEDRO, null, planned, 18, 70.5, new Share(ANDES, 18, 18),
                        new Share("DEMO-JX2", 6, 18), new Share(PEDRO, 17, 18), new Share(DEPOT, 12, 18)),
                new AssetFacts("DEMO-TR3", "CAMION", 2020, now.minus(Duration.ofMinutes(2)), -33.52, -70.70, 0.0,
                        false, NORTE, CLIENT, LUIS, null, null, 12, 41.0, new Share(PACIFICO, 12, 12), null,
                        new Share(LUIS, 7, 12), new Share(DEPOT, 9, 12)),
                new AssetFacts("DEMO-TR4", TRUCK, 2018, now.minus(Duration.ofHours(31)), -33.60, -70.80, 0.0, false,
                        NORTE, CLIENT, null, null, late, 4, 12.0, new Share(PACIFICO, 4, 4), null, null, null),
                new AssetFacts("DEMO-JX2", "Rampla plana", null, now.minus(Duration.ofHours(6)), -33.36, -70.74, 0.0,
                        null, NORTE, CLIENT, null, null, null, 7, 25.0, new Share(PACIFICO, 7, 7), null, null,
                        new Share(DEPOT, 5, 7)),
                new AssetFacts("DEMO-SEN1", "Señuelo", null, fresh, -33.45, -70.95, 78.0, null, NORTE, CLIENT, null,
                        open, null, 9, 30.0, null, null, null, null));
    }

    @Override
    public List<TripView> plannedTrips(String assetId) {
        Instant now = clock.get();
        return assetId.startsWith("DEMO-TR") ? List.of(
                new TripView("D-2001", PORT, DEPOT, ADDED, now.plus(Duration.ofHours(20)), null,
                        now.plus(Duration.ofHours(24)), ANDES, CARLOS, null)) : List.of();
    }

    @Override
    public List<TripView> recentTrips(String assetId, int limit) {
        Instant now = clock.get().truncatedTo(ChronoUnit.HOURS);
        List<TripView> trips = new ArrayList<>();
        for (int i = 1; i <= Math.min(limit, 6); i++) {
            Instant start = now.minus(Duration.ofDays(i)).minus(Duration.ofHours(6));
            trips.add(new TripView("D-09" + i, i % 2 == 0 ? DEPOT : PLANT, PORT, "CLOSED", start,
                    start.plus(Duration.ofHours(3L + i % 3)), start.plus(Duration.ofHours(4)), ANDES, CARLOS, null));
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
}
