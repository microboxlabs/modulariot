package com.microboxlabs.miot.symptoms.cases;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.core.gps.GpsDatabase;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorStream;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.jboss.logging.Logger;

/**
 * The evaluator's cases in the Control Tower, in the shapes the GPS database functions give the app: rows of
 * the symptom list, the treatment page's header and its signals. A case closes when an operator closes its
 * treatment.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class EngineCaseService {

    /** The list filters that still show the open cases: paging only. */
    private static final Set<String> PAGING = Set.of("p_page", "p_page_size");
    private static final String SYMPTOM_NAME = "symptom_name";
    private static final String ICU_CODE = "icu_code";
    private static final String ICU_CONDITION = "icu_condition";
    private static final Map<Integer, String> CONDITIONS = Map.of(1, "UNDER OBSERVATION", 2,
            "COMPROMISED CONDITION", 3, "CRITICAL CONDITION", 4, "CODE BLACK");
    private static final String TRIP = """
            SELECT trip_id, asset_id, carrier_name, origin_geofence_label, destination_geofence_label, driver_name,
                   second_driver_name, type_load, driver_contact_phone
              FROM live_trip WHERE trip_id = $1 AND asset_id = $2
            """;
    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    private static final Logger LOG = Logger.getLogger(EngineCaseService.class);

    /** Drops a symptom's episode for a vehicle, so its next signal can open a new case. */
    @FunctionalInterface
    public interface Forget {
        void episode(String tenantCode, String assetId, UUID definitionId);
    }

    private final EngineCaseStore store;
    private final Forget forget;
    private final Function<Tuple, Row> trips;
    private final Clock clock;

    @Inject
    EngineCaseService(EngineCaseStore store, EvaluatorStream evaluator, GpsDatabase gps) {
        this(store, evaluator::forget, gps.configured() ? t -> readTrip(gps, t) : t -> null, Clock.systemUTC());
    }

    private static Row readTrip(GpsDatabase gps, Tuple key) {
        var rows = gps.readPool().preparedQuery(TRIP).execute(key).await().atMost(Duration.ofSeconds(10))
                .iterator();
        return rows.hasNext() ? rows.next() : null;
    }

    private static String condition(int level) {
        return CONDITIONS.getOrDefault(level, CONDITIONS.get(1));
    }

    public EngineCaseService(EngineCaseStore store, Forget forget, Function<Tuple, Row> trips, Clock clock) {
        this.store = store;
        this.forget = forget;
        this.trips = trips;
        this.clock = clock;
    }

    /** Whether the list request only pages, so the open cases go first on its first page. */
    public static boolean showsOpenCases(Map<String, String> filters) {
        if (filters.keySet().stream().anyMatch(k -> !PAGING.contains(k) && notBlank(filters.get(k)))) {
            return false;
        }
        String page = filters.get("p_page");
        return page == null || page.isBlank() || page.trim().equals("1") || page.trim().equals("0");
    }

    /** The page with the open cases first; {@code page} null when the GPS database could not be read. */
    public JsonNode withOpenCases(String tenantCode, JsonNode page) {
        List<EngineCase> open = store.open(tenantCode);
        ObjectNode out = page != null && page.isObject() ? ((ObjectNode) page).deepCopy() : JSON.objectNode();
        ArrayNode rows = JSON.arrayNode();
        open.forEach(c -> rows.add(row(c)));
        if (out.path("data").isArray()) {
            rows.addAll((ArrayNode) out.get("data"));
        }
        out.set("data", rows);
        // Pinned on top of page 1: the totals stay the GPS function's, so they page as before.
        out.put("open_cases", open.size());
        if (!out.has("page")) {
            out.put("page", 1);
            out.put("page_size", rows.size());
            out.put("total_rows", rows.size());
            out.put("total_pages", 1);
            out.set("symptom_name_list", JSON.arrayNode());
        }
        return out;
    }

    public boolean hasOpenCases(String tenantCode) {
        return !store.open(tenantCode).isEmpty();
    }

    private ObjectNode row(EngineCase c) {
        ObjectNode r = JSON.objectNode();
        r.put("id", c.symptomId());
        r.put(SYMPTOM_NAME, c.name());
        r.put("type_of_incidence", c.name());
        r.put(ICU_CODE, String.valueOf(c.level()));
        r.put(ICU_CONDITION, condition(c.level()));
        r.put("asset_id", c.assetId());
        r.put("trip_id", c.tripId());
        r.put("start_time", c.openedAt().toString());
        r.put("duration_sec", Duration.between(c.openedAt(), clock.instant()).toSeconds());
        r.put("treatment_count", c.treatments());
        r.putNull("driver");
        return r;
    }

    /** The treatment page's header: the case, and its trip when it had one. */
    public JsonNode header(String tenantCode, long symptomId) {
        EngineCase c = find(tenantCode, symptomId);
        ObjectNode out = JSON.objectNode();
        out.set("conditions_agg", JSON.arrayNode());
        // One timeline entry with the case, which the map selects to load its point.
        ObjectNode entry = out.putArray("timeline").addObject();
        entry.put("start", c.openedAt().toString());
        entry.put("end", c.openedAt().toString());
        entry.put("symptom_id", c.symptomId());
        entry.put(SYMPTOM_NAME, c.name());
        ObjectNode agg = entry.putArray("conditions_agg").addObject();
        agg.put("start", c.openedAt().toString());
        agg.put("end", c.openedAt().toString());
        agg.put("symptom_id", c.symptomId());
        agg.put("is_symptom", 1);
        agg.put("type", c.name());
        agg.put("symptom_description", c.name());
        agg.put(ICU_CODE, String.valueOf(c.level()));
        agg.put(ICU_CONDITION, condition(c.level()));
        agg.put("count", 1);
        agg.putNull("assigned_to");
        agg.set("treatments", JSON.arrayNode());
        agg.putNull("evidences");
        ObjectNode symptom = out.putObject("symptom_info");
        symptom.put("id", c.symptomId());
        symptom.put("name", c.name());
        symptom.put("type", c.family());
        symptom.put(ICU_CODE, c.level());
        symptom.put(ICU_CONDITION, condition(c.level()));
        ObjectNode trip = out.putObject("trip_info");
        trip.put("asset_id", c.assetId());
        trip.put("trip_id", c.tripId());
        Row t = c.tripId() == null ? null : trip(c);
        if (t != null) {
            trip.put("carrier", t.getString("carrier_name"));
            trip.put("origin", t.getString("origin_geofence_label"));
            trip.put("destination", t.getString("destination_geofence_label"));
            trip.put("driver", t.getString("driver_name"));
            trip.put("driver2", t.getString("second_driver_name"));
            trip.put("type_load", t.getString("type_load"));
            trip.put("driver_contact", t.getString("driver_contact_phone"));
        }
        return out;
    }

    /** Where the vehicle was when the case opened, as a FeatureCollection with an EWKB point. */
    public JsonNode signals(String tenantCode, long symptomId) {
        EngineCase c = find(tenantCode, symptomId);
        ObjectNode out = JSON.objectNode();
        out.put("type", "FeatureCollection");
        ArrayNode features = out.putArray("features");
        if (c.latitude() != null && c.longitude() != null) {
            ObjectNode f = features.addObject();
            f.put("type", "Feature");
            f.put("geometry", ewkbPoint(c.longitude(), c.latitude()));
            ObjectNode props = f.putObject("properties");
            props.put("speed", c.speedKmh() == null ? 0 : c.speedKmh());
            props.put("timestamp", c.openedAt().toString());
        }
        ObjectNode description = out.putObject("description");
        description.put(SYMPTOM_NAME, c.name());
        description.put("first_signal_timestamp", c.openedAt().toString());
        description.put("last_signal_timestamp", c.openedAt().toString());
        if (c.speedKmh() != null) {
            description.put("last_reported_speed", c.speedKmh());
        }
        return out;
    }

    /**
     * An operator closed the case's treatment: the case closes, and the next signal may open a new one. The
     * episode goes first, so a failed drop leaves the case open and the call can be retried.
     */
    public void close(String tenantCode, long symptomId, String actor) {
        EngineCase c = find(tenantCode, symptomId);
        if (c.closedAt() == null) {
            forget.episode(tenantCode, c.assetId(), c.definitionId());
            store.close(tenantCode, c.id(), actor, clock.instant());
        }
    }

    /** The trip's details are optional: the header still answers when the GPS database cannot be read. */
    private Row trip(EngineCase c) {
        try {
            return trips.apply(Tuple.of(c.tripId(), c.assetId()));
        } catch (RuntimeException e) {
            LOG.debugf("Engine case %d: trip details unavailable (%s)", c.id(), e.getClass().getSimpleName());
            return null;
        }
    }

    private EngineCase find(String tenantCode, long symptomId) {
        long id = EngineCase.caseId(symptomId).orElseThrow(() -> new NoSuchElementException("Symptom not found"));
        return store.find(tenantCode, id).orElseThrow(() -> new NoSuchElementException("Symptom not found"));
    }

    /** A 2D point with SRID 4326, little endian, as PostGIS writes it in hex. */
    static String ewkbPoint(double longitude, double latitude) {
        ByteBuffer b = ByteBuffer.allocate(25).order(ByteOrder.LITTLE_ENDIAN);
        b.put((byte) 1).putInt(0x20000001).putInt(4326).putDouble(longitude).putDouble(latitude);
        return HexFormat.of().withUpperCase().formatHex(b.array());
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
