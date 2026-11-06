package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.store.PgIds.query;

import com.microboxlabs.miot.core.event.TextKey;
import com.microboxlabs.miot.symptoms.dto.TripPlace;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/** The origins and destinations of the organization's live trips ({@code miot_trips.trip_live}). */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgTripPlaces {

    /** The most places one answer lists. */
    static final int MAX_PLACES = 300;

    private static final String PLACES = """
            SELECT label, sum(origins) AS origins, sum(destinations) AS destinations FROM (
                SELECT btrim(origin_geofence_label) AS label, 1 AS origins, 0 AS destinations
                  FROM miot_trips.trip_live WHERE tenant_code = $1
                UNION ALL
                SELECT btrim(destination_geofence_label), 0, 1
                  FROM miot_trips.trip_live WHERE tenant_code = $1) p
             WHERE label IS NOT NULL AND label <> ''
             GROUP BY label
            """;

    private final Supplier<Pool> pool;

    @Inject
    PgTripPlaces(Instance<Pool> pool) {
        this.pool = pool::get;
    }

    public List<TripPlace> places(String tenantCode) {
        List<TripPlace> rows = new ArrayList<>();
        for (Row r : query(pool.get(), PLACES, Tuple.of(tenantCode))) {
            rows.add(new TripPlace(r.getString("label"), r.getLong("origins"), r.getLong("destinations")));
        }
        return merge(rows);
    }

    /**
     * One place per {@link TextKey}, named as most of its trips write it, with the counts added up; the busiest
     * first, then by name. At most {@link #MAX_PLACES}.
     */
    static List<TripPlace> merge(List<TripPlace> rows) {
        Map<String, List<TripPlace>> byKey = new LinkedHashMap<>();
        for (TripPlace p : rows) {
            String key = TextKey.of(p.label());
            if (!key.isEmpty()) {
                byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(p);
            }
        }
        Comparator<TripPlace> busiest = Comparator.comparingLong((TripPlace p) -> p.origins() + p.destinations())
                .reversed().thenComparing(TripPlace::label);
        return byKey.values().stream()
                .map(same -> {
                    String label = same.stream().sorted(busiest).findFirst().orElseThrow().label();
                    return new TripPlace(label, same.stream().mapToLong(TripPlace::origins).sum(),
                            same.stream().mapToLong(TripPlace::destinations).sum());
                })
                .sorted(busiest)
                .limit(MAX_PLACES)
                .toList();
    }
}
