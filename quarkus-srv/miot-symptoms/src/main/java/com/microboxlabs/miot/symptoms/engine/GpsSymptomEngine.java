package com.microboxlabs.miot.symptoms.engine;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * {@link SymptomEngine} over the GPS database's {@code public.rules}. Read only;
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
        Tuple clients = Tuple.tuple().addArrayOfString(tenants.clientIds(tenantCode).toArray(String[]::new));
        List<EngineRule> out = new ArrayList<>();
        for (Row r : pool.get().preparedQuery(RULES).execute(clients).await().atMost(QUERY_TIMEOUT)) {
            String closeOn = r.getString("condition_to_deactivate");
            out.add(new EngineRule(r.getInteger("id"), r.getString("rule_name"), r.getString("trigger_type"),
                    parse(r.getString("pattern")), Boolean.TRUE.equals(r.getBoolean("active")),
                    closeOn == null ? List.of() : Arrays.stream(closeOn.split(",")).map(String::trim).toList(),
                    Boolean.TRUE.equals(r.getBoolean("deactivate_with_signal"))));
        }
        return out;
    }

    private static Map<String, Object> parse(String json) {
        try {
            return json == null ? Map.of() : JSON.readValue(json, MAP);
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }
}
