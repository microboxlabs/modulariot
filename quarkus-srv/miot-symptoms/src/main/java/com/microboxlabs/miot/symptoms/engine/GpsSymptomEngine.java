package com.microboxlabs.miot.symptoms.engine;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * {@link SymptomEngine} over the GPS database: {@code public.rules},
 * {@code public.symptoms} and {@code public.accumulated_states}. Read only;
 * the pool it is given opens read-only sessions.
 */
public class GpsSymptomEngine implements SymptomEngine {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(15);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    private static final String RULES = """
            SELECT id, rule_name, trigger_type, event_pattern::text AS pattern, active,
                   condition_to_deactivate, deactivate_with_signal
            FROM public.rules
            WHERE client_id = ANY($1)
            ORDER BY id""";

    // first_signal_timestamp is indexed (partially on excluded = false); created_at is not.
    private static final String LEVEL_COUNTS = """
            SELECT symptom_name, icu_code, count(*) AS cases
            FROM public.symptoms
            WHERE client_id = ANY($1) AND excluded = false
              AND first_signal_timestamp >= $2 AND first_signal_timestamp < $3
            GROUP BY symptom_name, icu_code""";

    private static final String RECENT_CASES = """
            SELECT id, symptom_name, icu_code, trip_id::text AS trip_id, first_signal_timestamp,
                   last_signal_timestamp, accumulated_value::float8 AS accumulated_value, is_active, excluded
            FROM public.symptoms
            WHERE client_id = ANY($1) AND symptom_name = $2
              AND first_signal_timestamp >= $3
            ORDER BY first_signal_timestamp DESC
            LIMIT $4""";

    // accumulated_states has no time index; the newest ids are the newest episodes, so walk the primary key.
    private static final String SIGNAL_SAMPLES = """
            SELECT s.signal_last_speed::float8 AS speed, s.route_max_speed::float8 AS speed_limit,
                   extract(epoch FROM s.accumulated_seconds)::bigint AS held_s,
                   s.description ->> 'weight_category' AS weight_category,
                   (s.description ->> 'max_weight')::float8 AS max_weight,
                   s.description ->> 'authorized_zone' AS authorized_zone
            FROM public.accumulated_states s
            WHERE s.client_id = ANY($1)
              AND s.rule_id IN (SELECT r.id FROM public.rules r WHERE r.client_id = ANY($1) AND r.trigger_type = 'signal')
              AND s.signal_last_speed IS NOT NULL AND s.route_max_speed IS NOT NULL
            ORDER BY s.id DESC
            LIMIT $2""";

    private final Supplier<Pool> pool;
    private final EngineTenants tenants;

    public GpsSymptomEngine(Supplier<Pool> pool, EngineTenants tenants) {
        this.pool = pool;
        this.tenants = tenants;
    }

    @Override
    public boolean available() {
        return true;
    }

    @Override
    public List<EngineRule> rules(String tenantCode) {
        List<EngineRule> out = new ArrayList<>();
        for (Row r : query(tenantCode, RULES)) {
            String closeOn = r.getString("condition_to_deactivate");
            out.add(new EngineRule(r.getInteger("id"), r.getString("rule_name"), r.getString("trigger_type"),
                    parse(r.getString("pattern")), Boolean.TRUE.equals(r.getBoolean("active")),
                    closeOn == null ? List.of() : Arrays.stream(closeOn.split(",")).map(String::trim).toList(),
                    Boolean.TRUE.equals(r.getBoolean("deactivate_with_signal"))));
        }
        return out;
    }

    @Override
    public List<LevelCount> levelCounts(String tenantCode, OffsetDateTime from, OffsetDateTime to) {
        return query(tenantCode, LEVEL_COUNTS, from, to).stream()
                .map(r -> new LevelCount(r.getString("symptom_name"), r.getInteger("icu_code"), r.getLong("cases")))
                .toList();
    }

    @Override
    public List<EngineCase> recentCases(String tenantCode, String symptomName, OffsetDateTime since, int limit) {
        List<EngineCase> out = new ArrayList<>();
        for (Row r : query(tenantCode, RECENT_CASES, symptomName, since, limit)) {
            Double value = r.getDouble("accumulated_value");
            out.add(new EngineCase(r.getLong("id"), r.getString("symptom_name"), r.getInteger("icu_code"),
                    r.getString("trip_id"), r.getOffsetDateTime("first_signal_timestamp"),
                    r.getOffsetDateTime("last_signal_timestamp"),
                    value == null ? null : BigDecimal.valueOf(value),
                    Boolean.TRUE.equals(r.getBoolean("is_active")), Boolean.TRUE.equals(r.getBoolean("excluded"))));
        }
        return out;
    }

    @Override
    public List<Map<String, Object>> signalSamples(String tenantCode, int limit) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Row r : query(tenantCode, SIGNAL_SAMPLES, limit)) {
            Long held = r.getLong("held_s");
            out.add(signalSample(r.getDouble("speed"), r.getDouble("speed_limit"), r.getString("weight_category"),
                    r.getDouble("max_weight"), r.getString("authorized_zone"), held == null ? 0 : held));
        }
        return out;
    }

    /**
     * One {@code gps_signal}-shaped sample from an accumulated state. Episodes
     * exist only for signals already on a trip, so {@code trip.active} is true.
     */
    static Map<String, Object> signalSample(Double speed, Double limit, String weightCategory, Double maxWeight,
            String authorizedZone, long heldSeconds) {
        Map<String, Object> gps = new LinkedHashMap<>();
        gps.put("speed_kmh", speed);
        Map<String, Object> road = new LinkedHashMap<>();
        road.put("maxspeed_osm", limit);
        Map<String, Object> vehicle = new LinkedHashMap<>();
        vehicle.put("weight_category", weightCategory);
        vehicle.put("weight_kg", maxWeight);
        Map<String, Object> geo = new LinkedHashMap<>();
        geo.put("authorized_zone", "1".equals(authorizedZone));
        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("trip", Map.of("active", true));
        signal.put("vehicle", vehicle);
        signal.put("gps", gps);
        signal.put("road", road);
        signal.put("geo", geo);
        Map<String, Object> sample = new LinkedHashMap<>();
        sample.put("signal", signal);
        sample.put("held_s", heldSeconds);
        return sample;
    }

    private RowSet<Row> query(String tenantCode, String sql, Object... params) {
        List<String> clients = tenants.clientIds(tenantCode);
        Tuple tuple = Tuple.tuple().addArrayOfString(clients.toArray(String[]::new));
        for (Object p : params) {
            tuple.addValue(p);
        }
        return pool.get().preparedQuery(sql).execute(tuple).await().atMost(QUERY_TIMEOUT);
    }

    private static Map<String, Object> parse(String json) {
        try {
            return json == null ? Map.of() : JSON.readValue(json, MAP);
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }
}
