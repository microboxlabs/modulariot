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

    private static final String CASES_PAGE = """
            SELECT id, symptom_name, icu_code, trip_id::text AS trip_id, first_signal_timestamp,
                   last_signal_timestamp, accumulated_value::float8 AS accumulated_value, is_active, excluded
            FROM public.symptoms
            WHERE client_id = ANY($1) AND symptom_name = $2 AND excluded = false
              AND first_signal_timestamp >= $3 AND first_signal_timestamp < $4
              AND icu_code = ANY($5) AND id > $6
            ORDER BY id
            LIMIT $7""";

    // accumulated_states has no time index; the newest ids are the newest episodes, so walk the primary key.

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
        return cases(query(tenantCode, RECENT_CASES, symptomName, since, limit));
    }

    private static List<EngineCase> cases(RowSet<Row> rows) {
        List<EngineCase> out = new ArrayList<>();
        for (Row r : rows) {
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
    public List<EngineCase> casesPage(String tenantCode, String symptomName, OffsetDateTime from, OffsetDateTime to,
            List<Integer> icus, long afterId, int limit) {
        return cases(query(tenantCode, CASES_PAGE, symptomName, from, to, icus.toArray(Integer[]::new), afterId,
                limit));
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
