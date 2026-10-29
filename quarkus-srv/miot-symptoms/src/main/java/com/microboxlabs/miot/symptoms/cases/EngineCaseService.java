package com.microboxlabs.miot.symptoms.cases;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorStream;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.List;
import java.util.LinkedHashSet;
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

    private static final Set<String> PAGING = Set.of("p_page", "p_page_size");
    private static final String TRIP_ID = "p_trip_id";
    private static final String ASSET_ID = "p_asset_id";
    private static final String NAME = "p_symptom_name";
    private static final String LEVEL = "p_icu_code";
    private static final String FROM = "p_start_date_historic";
    private static final String TO = "p_end_date_historic";
    /** The list filters the cases answer; any other one leaves them out. */
    private static final Set<String> CASE_FILTERS = Set.of(TRIP_ID, ASSET_ID, NAME, LEVEL, FROM, TO);
    private static final String SYMPTOM_NAME = "symptom_name";
    private static final String CONDITIONS_AGG = "conditions_agg";
    private static final String SYMPTOM_NAMES = "symptom_name_list";
    private static final String ICU_CODE = "icu_code";
    private static final String ICU_CONDITION = "icu_condition";
    private static final Map<Integer, String> CONDITIONS = Map.of(1, "UNDER OBSERVATION", 2,
            "COMPROMISED CONDITION", 3, "CRITICAL CONDITION", 4, "CODE BLACK");
    private static final String UNDER_TREATMENT = "UNDER TREATMENT";
    /** The keys of the GPS database's counts by condition. */
    private static final Map<Integer, String> COUNTED = Map.of(1, "Under Observation", 2, "Compromised condition",
            3, "Critical condition", 4, "Code Black");
    private static final String COUNTED_UNDER_TREATMENT = "Under Treatment";
    /** The case's trip while it runs; a finished trip has no row. */
    private static final String TRIP = """
            SELECT trip_id, asset_id,
                   (CASE jsonb_typeof(mandate_codes) WHEN 'string' THEN (mandate_codes #>> '{}')::jsonb
                         ELSE mandate_codes END) -> 0 ->> 'code' AS code,
                   carrier_name, origin_geofence_label, destination_geofence_label, driver_name, second_driver_name,
                   type_load, driver_contact_phone
              FROM miot_trips.trip_live WHERE tenant_code = $1 AND trip_id::text = $2 AND asset_id = $3
            """;
    /** How far before the case the map shows the vehicle's signals, unless an earlier case of it is nearer. */
    static final Duration SIGNALS_BEFORE = Duration.ofHours(1);
    static final Duration SIGNALS_AT_MOST = Duration.ofDays(7);
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
    private final SymptomEvents events;

    @Inject
    EngineCaseService(EngineCaseStore store, EvaluatorStream evaluator, Instance<Pool> pool, SymptomEvents events) {
        this(store, evaluator::forget, t -> readTrip(pool.get(), t), Clock.systemUTC(), events);
    }

    private static Row readTrip(Pool pool, Tuple key) {
        var rows = pool.preparedQuery(TRIP).execute(key).await().atMost(Duration.ofSeconds(10)).iterator();
        return rows.hasNext() ? rows.next() : null;
    }

    private static String condition(int level) {
        return CONDITIONS.getOrDefault(level, CONDITIONS.get(1));
    }

    public EngineCaseService(EngineCaseStore store, Forget forget, Function<Tuple, Row> trips, Clock clock) {
        this(store, forget, trips, clock, SymptomEvents.NONE);
    }

    public EngineCaseService(EngineCaseStore store, Forget forget, Function<Tuple, Row> trips, Clock clock,
            SymptomEvents events) {
        this.store = store;
        this.forget = forget;
        this.trips = trips;
        this.clock = clock;
        this.events = events;
    }

    /**
     * Whether the list request's first page shows the cases: it is the first page, and it filters by nothing the
     * cases cannot answer (driver, carrier, origin, destination).
     */
    public static boolean showsCases(Map<String, String> filters) {
        if (filters.keySet().stream().anyMatch(k -> !PAGING.contains(k) && !CASE_FILTERS.contains(k)
                && notBlank(filters.get(k)))) {
            return false;
        }
        String page = filters.get("p_page");
        return page == null || page.isBlank() || page.trim().equals("1") || page.trim().equals("0");
    }

    /**
     * The list filters as a case filter. Without dates, the open cases; with them, those active in the range.
     * A date without an offset is UTC.
     *
     * @throws IllegalArgumentException when the level is not a number or a date is not ISO-8601
     */
    public static EngineCaseStore.CaseFilter filter(Map<String, String> filters) {
        String level = text(filters, LEVEL);
        try {
            return new EngineCaseStore.CaseFilter(text(filters, TRIP_ID), text(filters, ASSET_ID),
                    text(filters, NAME), level == null ? null : Integer.valueOf(level), instant(text(filters, FROM)),
                    instant(text(filters, TO)));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(LEVEL + " must be a whole number");
        }
    }

    private static String text(Map<String, String> filters, String name) {
        String v = filters.get(name);
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static Instant instant(String value) {
        if (value == null) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException e) {
            // Without an offset.
        }
        try {
            return LocalDateTime.parse(value).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException e) {
            // A date alone.
        }
        try {
            return LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Dates must be ISO-8601: " + value);
        }
    }

    /**
     * The page with the matching cases first; {@code page} null when the GPS database could not be read. A
     * filtered page holds a trip's or a vehicle's few cases, so they come whole on page 1.
     */
    public JsonNode withCases(String tenantCode, Map<String, String> filters, JsonNode page) {
        List<EngineCase> found = store.list(tenantCode, filter(filters));
        ObjectNode out = page != null && page.isObject() ? ((ObjectNode) page).deepCopy() : JSON.objectNode();
        ArrayNode rows = JSON.arrayNode();
        found.forEach(c -> rows.add(row(c)));
        if (out.path("data").isArray()) {
            rows.addAll((ArrayNode) out.get("data"));
        }
        out.set("data", rows);
        // Pinned on top of page 1: the totals stay the GPS function's, so they page as before.
        out.put("engine_cases", found.size());
        if (!out.has("page")) {
            out.put("page", 1);
            out.put("page_size", rows.size());
            out.put("total_rows", rows.size());
            out.put("total_pages", 1);
            out.set(SYMPTOM_NAMES, JSON.arrayNode());
        }
        Set<String> names = new LinkedHashSet<>();
        out.path(SYMPTOM_NAMES).forEach(name -> names.add(name.asText()));
        found.forEach(c -> names.add(c.name()));
        ArrayNode choices = JSON.arrayNode();
        names.forEach(choices::add);
        out.set(SYMPTOM_NAMES, choices);
        return out;
    }

    /**
     * The counts by condition with the open cases added, each once: under treatment while it has an open
     * treatment, else at its level. {@code counts} is null when the GPS database could not be read; when the
     * open cases cannot be read, the GPS counts are answered alone.
     */
    public JsonNode withOpenCaseCounts(String tenantCode, JsonNode counts) {
        List<EngineCaseStore.OpenCount> open;
        try {
            open = store.openCounts(tenantCode);
        } catch (RuntimeException e) {
            if (counts == null) {
                throw e;
            }
            LOG.warnf(e, "Open cases not counted: tenant=%s", tenantCode);
            return counts;
        }
        ObjectNode out = counts != null && counts.isObject() ? ((ObjectNode) counts).deepCopy() : JSON.objectNode();
        for (EngineCaseStore.OpenCount c : open) {
            String key = c.underTreatment() ? COUNTED_UNDER_TREATMENT : COUNTED.getOrDefault(c.level(), COUNTED.get(1));
            out.put(key, out.path(key).asLong(0) + c.count());
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
        r.put(ICU_CONDITION, c.treatments() > 0 ? UNDER_TREATMENT : condition(c.level()));
        r.put("asset_id", c.assetId());
        r.put("trip_id", c.tripId());
        r.put("start_time", c.openedAt().toString());
        if (c.closedAt() != null) {
            r.put("end_time", c.closedAt().toString());
        }
        Instant until = c.closedAt() != null ? c.closedAt() : clock.instant();
        r.put("duration_sec", Duration.between(c.openedAt(), until).toSeconds());
        r.put("treatment_count", c.treatments());
        r.put("sla_minutes", c.slaMinutes());
        r.put("recurrence_events", c.recurrence());
        r.putNull("driver");
        return r;
    }

    /** The treatment page's header: the case, and its trip when it had one. */
    public JsonNode header(String tenantCode, long symptomId) {
        EngineCase c = find(tenantCode, symptomId);
        ObjectNode out = JSON.objectNode();
        out.set(CONDITIONS_AGG, JSON.arrayNode());
        // One timeline entry with the case, which the map selects to load its point.
        String end = (c.closedAt() != null ? c.closedAt() : c.openedAt()).toString();
        ObjectNode entry = out.putArray("timeline").addObject();
        entry.put("start", c.openedAt().toString());
        entry.put("end", end);
        entry.put("symptom_id", c.symptomId());
        entry.put(SYMPTOM_NAME, c.name());
        ObjectNode agg = entry.putArray(CONDITIONS_AGG).addObject();
        agg.put("start", c.openedAt().toString());
        agg.put("end", end);
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
        Row t = c.tripId() == null ? null : trip(tenantCode, c);
        if (t != null) {
            trip.put("trip_code", t.getString("code"));
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
     * The header with the case's treatments in its timeline, one entry per call, ignore or invalidate action,
     * in the shape of the GPS database's treatments. Cancelled treatments and notes are left out.
     */
    public static JsonNode withTreatments(JsonNode header, List<TreatmentView> treatments) {
        ObjectNode out = header.deepCopy();
        ArrayNode rows = JSON.arrayNode();
        String assignedTo = null;
        for (TreatmentView t : treatments) {
            if (t.status() == TreatmentStatus.CANCELLED) {
                continue;
            }
            assignedTo = t.closedBy() != null ? t.closedBy() : t.openedBy();
            t.actions().stream().filter(a -> a.kind() != ActionKind.NOTE).forEach(a -> rows.add(timelineRow(a)));
        }
        for (JsonNode entry : out.path("timeline")) {
            for (JsonNode agg : entry.path(CONDITIONS_AGG)) {
                ((ObjectNode) agg).set("treatments", rows.deepCopy());
                ((ObjectNode) agg).put("assigned_to", assignedTo);
            }
        }
        return out;
    }

    private static ObjectNode timelineRow(TreatmentAction a) {
        ObjectNode row = JSON.objectNode();
        ObjectNode description = row.putObject("description");
        if (a.kind() == ActionKind.CALL) {
            row.put("treatment_type", "llamar al conductor");
            description.put("message", a.message() != null ? a.message() : "Llamado a: " + a.contactName());
            description.put("driver_response", joined(a.outcomeLabel(), a.note()));
        } else {
            row.put("treatment_type", a.kind() == ActionKind.IGNORE ? "ignorar condicion" : "invalidar sintoma");
            description.put("message", a.outcomeLabel());
            description.put("driver_response", a.note());
        }
        return row;
    }

    private static String joined(String first, String second) {
        if (first == null || first.isBlank()) {
            return second;
        }
        return second == null || second.isBlank() ? first : first + " · " + second;
    }

    /** The vehicle and the time range of the signals the treatment page shows for a case. */
    public record SignalWindow(String assetId, Instant from, Instant to) {
    }

    /**
     * From an hour before the case opened, or from the vehicle's previous case when that opened later, until
     * the case closed or now; at most {@link #SIGNALS_AT_MOST} after the opening.
     */
    public SignalWindow signalWindow(String tenantCode, long symptomId) {
        EngineCase c = find(tenantCode, symptomId);
        Instant opened = c.openedAt();
        Instant earliest = opened.minus(SIGNALS_BEFORE);
        Instant from = store.previousOpening(tenantCode, c.assetId(), c.id(), earliest, opened).orElse(earliest);
        Instant end = c.closedAt() != null ? c.closedAt() : clock.instant();
        Instant cap = opened.plus(SIGNALS_AT_MOST);
        Instant to = end.isAfter(cap) ? cap : end;
        return new SignalWindow(c.assetId(), from, to.isBefore(opened) ? opened : to);
    }

    /**
     * An operator closed the case's treatment: the case closes, and the next signal may open a new one. The
     * episode goes first, so a failed drop leaves the case open and the call can be retried. Publishes
     * {@code symptom.case.closed}.
     */
    public void close(String tenantCode, long symptomId, String actor) {
        EngineCase c = find(tenantCode, symptomId);
        if (c.closedAt() == null) {
            forget.episode(tenantCode, c.assetId(), c.definitionId());
            Instant at = clock.instant();
            if (store.close(tenantCode, c.id(), actor, at)) {
                events.closedByOperator(tenantCode, c, actor, at);
            }
        }
    }

    /** The trip's details are optional: the header still answers without them. */
    private Row trip(String tenantCode, EngineCase c) {
        try {
            return trips.apply(Tuple.of(tenantCode, c.tripId(), c.assetId()));
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
