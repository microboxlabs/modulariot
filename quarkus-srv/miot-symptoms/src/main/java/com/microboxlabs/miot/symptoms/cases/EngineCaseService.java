package com.microboxlabs.miot.symptoms.cases;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.dto.TripPeople;
import com.microboxlabs.miot.symptoms.dto.TripRoute;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorStream;
import com.microboxlabs.miot.symptoms.evaluator.OperatorClose;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector;
import com.microboxlabs.miot.symptoms.lostsignal.SignalStateReader.Reported;
import com.microboxlabs.miot.symptoms.map.TripWindows;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
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

    private static final String PAGE = "p_page";
    private static final Set<String> PAGING = Set.of(PAGE, "p_page_size");
    private static final String POSITION_ASSET_ID = "asset_id";
    /** The vehicle the case's trip is on now; differs from {@code asset_id} after a truck change. */
    private static final String TRIP_ASSET_ID = "trip_asset_id";
    private static final String TRIP_ID = "p_trip_id";
    private static final String ASSET_ID = "p_asset_id";
    private static final String NAME = "p_symptom_name";
    private static final String LEVEL = "p_icu_code";
    private static final String FROM = "p_start_date_historic";
    private static final String TO = "p_end_date_historic";
    private static final String DRIVER = "p_driver_id";
    private static final String CARRIER = "p_carrier_id";
    private static final String CARRIER_TAX_ID = "carrier_tax_id";
    private static final String CONTEXT_FIELD = "context";
    private static final String LEVEL_FIELD = "level";
    private static final String DRIVER_FIELD = "driver";
    private static final String CARRIER_FIELD = "carrier";
    private static final String ORIGIN_FIELD = "origin";
    private static final String ORIGIN_LABEL = "origin_geofence_label";
    private static final String DESTINATION_LABEL = "destination_geofence_label";
    private static final String DESTINATION_FIELD = "destination";
    private static final String DRIVER_ID = "driver_id";
    private static final String SECOND_DRIVER_ID = "second_driver_id";
    private static final String SYMPTOM_ID = "symptom_id";
    private static final String TYPE_LOAD = "type_load";
    private static final String ORIGIN = "p_origin";
    private static final String DESTINATION = "p_destination";
    /**
     * The list filters under which the GPS database's page shows the cases first; any other one leaves them out.
     * The engine-only list ({@link #casesPage}) also answers driver, carrier, origin and destination.
     */
    private static final Set<String> CASE_FILTERS = Set.of(TRIP_ID, ASSET_ID, NAME, LEVEL, FROM, TO);
    private static final String SYMPTOM_NAME = "symptom_name";
    private static final String CONDITIONS_AGG = "conditions_agg";
    private static final String START = "start";
    private static final String SYMPTOM_NAMES = "symptom_name_list";
    private static final String ICU_CODE = "icu_code";
    private static final String OPENED_AT = "opened_at";
    private static final String ICU_CONDITION = "icu_condition";
    private static final Map<Integer, String> CONDITIONS = Map.of(1, "UNDER OBSERVATION", 2,
            "COMPROMISED CONDITION", 3, "CRITICAL CONDITION", 4, "CODE BLACK");
    private static final String UNDER_TREATMENT = "UNDER TREATMENT";
    /** The keys of the GPS database's counts by condition. */
    private static final Map<Integer, String> COUNTED = Map.of(1, "Under Observation", 2, "Compromised condition",
            3, "Critical condition", 4, "Code Black");
    private static final String DESCRIPTION = "description";
    private static final String SPEED_LIMIT = "speed_limit";
    private static final String TREATMENT_TYPE = "treatment_type";
    private static final String MESSAGE = "message";
    private static final String TREATMENTS = "treatments";
    private static final String TIMELINE = "timeline";
    private static final String CURRENT = "current";
    private static final String DRIVER_RESPONSE = "driver_response";
    /** The treatment type of a note rule's timeline entry. */
    static final String NOTE_TYPE = "evento del gps";
    private static final String COUNTED_UNDER_TREATMENT = "Under Treatment";
    /** The count of the open cases a hold covers ("Ignorados"), out of the other counts. */
    static final String COUNTED_IGNORED = "Ignored";
    /** {@code p_icu_code} for the open cases a hold covers. */
    public static final int IGNORED_CODE = 9;
    /** The case's trip while it runs; a finished trip has no row. */
    private static final String TRIP = """
            SELECT tl.trip_id, tl.asset_id, tl.carrier_name, c.rut AS carrier_tax_id, tl.origin_geofence_label,
                   tl.destination_geofence_label, tl.driver_name, tl.second_driver_name, tl.type_load,
                   tl.driver_contact_phone, tl.driver_id, tl.second_driver_id, tl.origin_geofence_id,
                   tl.destination_geofence_id
              FROM miot_trips.trip_live tl
              LEFT JOIN miot_fleet.carrier c ON c.tenant_code = tl.tenant_code AND c.id::text = tl.carrier_id
             WHERE tl.tenant_code = $1 AND tl.trip_id::text = $2 AND tl.asset_id = $3
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

        /** The operator closed the case on this trip (null when it had none); the open rule may read it. */
        default void closed(String tenantCode, String assetId, UUID definitionId, String tripId) {
            episode(tenantCode, assetId, definitionId);
        }

        /** As {@link #closed(String, String, UUID, String)}, with how the operator closed the case. */
        default void closed(String tenantCode, String assetId, UUID definitionId, OperatorClose close) {
            closed(tenantCode, assetId, definitionId, close.tripId());
        }

        default Consumer<OperatorClose> operatorClose(String tenant, String asset, UUID definition) {
            return close -> closed(tenant, asset, definition, close);
        }

        default void staleEpisode(EngineCaseStore.StaleCase c) {
            episode(c.tenantCode(), c.assetId(), c.definitionId());
        }
    }

    private final EngineCaseStore store;
    private final Forget forget;
    private final Function<Tuple, Row> trips;
    private final Clock clock;
    private final SymptomEvents events;
    private final Vehicles vehicles;
    private final TripTracks tripTracks;
    private static final String CHECK = "check";

    /** The time range of a case's trip for its map ({@link TripWindows#track}); empty without one. */
    @FunctionalInterface
    public interface TripTracks {
        TripTracks NONE = (tenantCode, tripId, assetId) -> Optional.empty();

        Optional<TripWindows.Window> track(String tenantCode, String tripId, String assetId);
    }

    /** What the lost-signal detector's profiles say about a vehicle now; empty without a profile. */
    @FunctionalInterface
    public interface Vehicles {
        Vehicles NONE = (assetId, now) -> Optional.empty();

        Optional<Reported> reported(String assetId, Instant now);
    }

    @Inject
    EngineCaseService(EngineCaseStore store, EvaluatorStream evaluator, Instance<Pool> pool, SymptomEvents events,
            LostSignalDetector lostSignal, TripWindows tripWindows) {
        this(store, new Forget() {
            @Override
            public void episode(String tenantCode, String assetId, UUID definitionId) {
                evaluator.forget(tenantCode, assetId, definitionId);
            }

            @Override
            public void closed(String tenantCode, String assetId, UUID definitionId, String tripId) {
                evaluator.forget(tenantCode, assetId, definitionId, tripId);
            }

            @Override
            public void closed(String tenantCode, String assetId, UUID definitionId, OperatorClose close) {
                evaluator.closedByOperator(tenantCode, assetId, definitionId, close);
            }

            @Override
            public Consumer<OperatorClose> operatorClose(String tenant, String asset, UUID definition) {
                return evaluator.operatorCloseAction(tenant, asset, definition);
            }

            @Override
            public void staleEpisode(EngineCaseStore.StaleCase c) {
                evaluator.forgetStale(c);
            }
        }, t -> readTrip(pool.get(), t), Clock.systemUTC(), events,
                lostSignal::reported, (tenant, trip, asset) -> TripWindows.tripsModuleId(trip)
                        .flatMap(id -> tripWindows.track(tenant, id, asset)));
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
        this(store, forget, trips, clock, events, Vehicles.NONE);
    }

    public EngineCaseService(EngineCaseStore store, Forget forget, Function<Tuple, Row> trips, Clock clock,
            SymptomEvents events, Vehicles vehicles) {
        this(store, forget, trips, clock, events, vehicles, TripTracks.NONE);
    }

    public EngineCaseService(EngineCaseStore store, Forget forget, Function<Tuple, Row> trips, Clock clock,
            SymptomEvents events, Vehicles vehicles, TripTracks tripTracks) {
        this.vehicles = vehicles;
        this.tripTracks = tripTracks;
        this.store = store;
        this.forget = forget;
        this.trips = trips;
        this.clock = clock;
        this.events = events;
    }

    /**
     * Whether the list request's first page shows the cases: it is the first page, and it filters by nothing outside
     * {@link #CASE_FILTERS} (driver, carrier, origin, destination).
     */
    public static boolean showsCases(Map<String, String> filters) {
        if (filters.keySet().stream().anyMatch(k -> !PAGING.contains(k) && !CASE_FILTERS.contains(k)
                && notBlank(filters.get(k)))) {
            return false;
        }
        String page = filters.get(PAGE);
        return page == null || page.isBlank() || page.trim().equals("1") || page.trim().equals("0");
    }

    /**
     * The list filters as a case filter. Without dates, the open cases no hold covers; with them, those active in
     * the range. {@code p_icu_code} {@value #IGNORED_CODE} keeps the open cases a hold covers ("Ignorados"). A date
     * without an offset is UTC.
     *
     * @throws IllegalArgumentException when the level is not a number or a date is not ISO-8601
     */
    public static EngineCaseStore.CaseFilter filter(Map<String, String> filters) {
        String level = text(filters, LEVEL);
        try {
            EngineCaseStore.CaseFilter f = new EngineCaseStore.CaseFilter(text(filters, TRIP_ID),
                    text(filters, ASSET_ID), text(filters, NAME), level == null ? null : Integer.valueOf(level),
                    instant(text(filters, FROM)), instant(text(filters, TO)), text(filters, DRIVER),
                    text(filters, CARRIER), text(filters, ORIGIN), text(filters, DESTINATION));
            return Integer.valueOf(IGNORED_CODE).equals(f.level()) ? f.withIgnored() : f;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(LEVEL + " must be a whole number");
        }
    }

    /**
     * Without dates the list is the tower inbox: only the cases whose current level asks for an operator. With
     * dates it is the history, which keeps every case.
     */
    static EngineCaseStore.CaseFilter inbox(EngineCaseStore.CaseFilter filter) {
        return filter.openOnly() ? filter.forOperator() : filter;
    }

    /**
     * The inbox's order, by criticality: the highest level first; within a level, the SLA that runs out soonest
     * (overdue first, a level without SLA last); then the oldest arrival at the level; then the case id, so a
     * refresh keeps the order.
     */
    static final Comparator<EngineCase> INBOX_ORDER = Comparator
            .<EngineCase>comparingInt(EngineCase::level).reversed()
            .thenComparing(EngineCase::slaDeadline, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(c -> c.levelAt() != null ? c.levelAt() : c.openedAt())
            .thenComparingLong(EngineCase::id);

    /**
     * The store's cases for the list, in the inbox's order without dates. {@code operator} null is the default
     * ({@link #inbox}); any other value keeps the cases it names, with or without dates.
     */
    private List<EngineCase> listed(String tenantCode, EngineCaseStore.CaseFilter filter, Viewer viewer) {
        EngineCaseStore.CaseFilter f = scoped(filter, viewer);
        List<EngineCase> found = store.list(tenantCode, f);
        return f.openOnly() ? found.stream().sorted(INBOX_ORDER).toList() : found;
    }

    /**
     * What a list or count request asks beyond the list filters, and who asks.
     *
     * @param operator  the cases to keep by whether their level goes to the operators; null is the default
     *                  ({@link #inbox})
     * @param treatment the cases to keep by treatment state; null keeps every case
     * @param actor     the caller, so a row says whether an open treatment is the caller's own; null when unknown
     */
    public record Viewer(EngineCaseStore.OperatorScope operator, EngineCase.TreatmentState treatment, String actor) {

        public static final Viewer DEFAULT = new Viewer(null, null, null);

        public static Viewer of(EngineCaseStore.OperatorScope operator) {
            return new Viewer(operator, null, null);
        }
    }

    private static EngineCaseStore.CaseFilter scoped(EngineCaseStore.CaseFilter filter, Viewer viewer) {
        EngineCaseStore.CaseFilter f = viewer.operator() == null ? inbox(filter) : filter.operator(viewer.operator());
        return f.treatment(viewer.treatment());
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
     * filtered page holds a trip's or a vehicle's few cases, so they come whole on page 1. Without dates only the
     * cases that need an operator ({@link #inbox}).
     */
    public JsonNode withCases(String tenantCode, Map<String, String> filters, JsonNode page) {
        return withCases(tenantCode, filters, page, Viewer.DEFAULT);
    }

    /** As {@link #withCases(String, Map, JsonNode)}, keeping the cases {@code operator} names (null: the default). */
    public JsonNode withCases(String tenantCode, Map<String, String> filters, JsonNode page,
            EngineCaseStore.OperatorScope operator) {
        return withCases(tenantCode, filters, page, Viewer.of(operator));
    }

    /** As {@link #withCases(String, Map, JsonNode)}, for what {@code viewer} asks. */
    public JsonNode withCases(String tenantCode, Map<String, String> filters, JsonNode page, Viewer viewer) {
        List<EngineCase> found = listed(tenantCode, filter(filters), viewer);
        ObjectNode out = page != null && page.isObject() ? ((ObjectNode) page).deepCopy() : JSON.objectNode();
        ArrayNode rows = JSON.arrayNode();
        found.forEach(c -> rows.add(row(c, viewer.actor())));
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
     * The counts by condition with the open cases that need an operator added, each once, so they match the inbox
     * list: under {@value #COUNTED_IGNORED} while a hold
     * covers it, else under treatment while it has an open treatment, else at its level. {@code counts} is null when the GPS database could not be read; when the
     * open cases cannot be read, the GPS counts are answered alone.
     */
    public JsonNode withOpenCaseCounts(String tenantCode, JsonNode counts) {
        return withOpenCaseCounts(tenantCode, counts, null);
    }

    /**
     * As {@link #withOpenCaseCounts(String, JsonNode)}, counting the open cases {@code operator} names (null: those
     * that need an operator).
     */
    public JsonNode withOpenCaseCounts(String tenantCode, JsonNode counts, EngineCaseStore.OperatorScope operator) {
        EngineCaseStore.TowerCounts engineCounts;
        try {
            engineCounts = store.towerCounts(tenantCode,
                    operator == null ? EngineCaseStore.OperatorScope.REQUIRED : operator);
        } catch (RuntimeException e) {
            if (counts == null) {
                throw e;
            }
            LOG.warnf(e, "Open cases not counted: tenant=%s", tenantCode);
            return counts;
        }
        ObjectNode out = counts != null && counts.isObject() ? ((ObjectNode) counts).deepCopy() : JSON.objectNode();
        for (EngineCaseStore.OpenCount c : engineCounts.active()) {
            String key = c.underTreatment() ? COUNTED_UNDER_TREATMENT : COUNTED.getOrDefault(c.level(), COUNTED.get(1));
            out.put(key, out.path(key).asLong(0) + c.count());
        }
        long ignored = engineCounts.ignored();
        if (ignored > 0) {
            out.put(COUNTED_IGNORED, out.path(COUNTED_IGNORED).asLong(0) + ignored);
        }
        return out;
    }

    private static final int PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 200;

    /**
     * One page of the symptom list from the cases alone, in the GPS database function's shape, with totals counted
     * over the matching cases (at most the store's page of them). Without dates only the cases that need an
     * operator ({@link #inbox}).
     *
     * @param filters already checked by {@code ControlTowerMapService.symptomFilters}
     */
    public JsonNode casesPage(String tenantCode, Map<String, String> filters) {
        return casesPage(tenantCode, filters, Viewer.DEFAULT);
    }

    /** As {@link #casesPage(String, Map)}, keeping the cases {@code operator} names (null: the default). */
    public JsonNode casesPage(String tenantCode, Map<String, String> filters,
            EngineCaseStore.OperatorScope operator) {
        return casesPage(tenantCode, filters, Viewer.of(operator));
    }

    /**
     * As {@link #casesPage(String, Map)}, for what {@code viewer} asks. The treatment state filters before paging,
     * so the totals count the cases in that state.
     */
    public JsonNode casesPage(String tenantCode, Map<String, String> filters, Viewer viewer) {
        EngineCaseStore.OperatorScope operator = viewer.operator();
        EngineCaseStore.CaseFilter filter = filter(filters);
        if (Integer.valueOf(6).equals(filter.level())) {
            filter = filter.withOpenTreatment();
        }
        int requestedSize = Math.max(1, number(filters.get("p_page_size"), PAGE_SIZE));
        boolean bounded = operator == null && viewer.treatment() == null;
        int size = bounded ? requestedSize : Math.min(requestedSize, MAX_PAGE_SIZE);
        int page = Math.max(1, number(filters.get(PAGE), 1));
        EngineCaseStore.CasePage result;
        if (bounded) {
            // Preserve the bounded list contract for callers that omit operator.
            List<EngineCase> found = listed(tenantCode, filter, viewer);
            result = new EngineCaseStore.CasePage(
                    found.stream().skip((long) (page - 1) * size).limit(size).toList(), found.size(),
                    found.stream().map(EngineCase::name).distinct().toList());
        } else {
            result = store.page(tenantCode, scoped(filter, viewer), page, size);
        }
        long pages = Math.max(1, Math.ceilDiv(result.total(), size));
        ArrayNode rows = JSON.arrayNode();
        var ordered = result.cases().stream();
        if (filter.openOnly()) {
            ordered = ordered.sorted(INBOX_ORDER);
        }
        ordered.forEach(c -> rows.add(row(c, viewer.actor())));
        ObjectNode out = JSON.objectNode();
        out.set("data", rows);
        out.put("page", page);
        out.put("page_size", size);
        out.put("total_rows", result.total());
        out.put("total_pages", pages);
        out.put("engine_cases", result.total());
        ArrayNode names = out.putArray(SYMPTOM_NAMES);
        result.names().forEach(names::add);
        return out;
    }

    private static int number(String value, int otherwise) {
        try {
            return value == null || value.isBlank() ? otherwise : Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Paging must be a whole number");
        }
    }

    /**
     * The counts by condition of the cases alone, in the GPS database's keys: the open cases as
     * {@link #withOpenCaseCounts}, or with {@code from} and {@code to} the cases opened in that range, by their
     * current level.
     *
     * @throws IllegalArgumentException when only one date is given, or a date is not ISO-8601
     */
    public JsonNode caseCounts(String tenantCode, String from, String to) {
        return caseCounts(tenantCode, from, to, null);
    }

    /**
     * As {@link #caseCounts(String, String, String)}, counting the cases {@code operator} names. Null is the
     * default: the open cases that need an operator, or with dates every case opened in the range.
     */
    public JsonNode caseCounts(String tenantCode, String from, String to, EngineCaseStore.OperatorScope operator) {
        if (notBlank(from) != notBlank(to)) {
            throw new IllegalArgumentException("Send both from and to, or neither");
        }
        if (!notBlank(from)) {
            return withOpenCaseCounts(tenantCode, null, operator);
        }
        Instant start = instant(from.trim());
        Instant end = instant(to.trim());
        ObjectNode out = JSON.objectNode();
        for (EngineCaseStore.LevelCount c : store.openedCounts(tenantCode, start, end)) {
            long counted = switch (operator == null ? EngineCaseStore.OperatorScope.ALL : operator) {
                case REQUIRED -> c.count() - c.withoutOperator();
                case NONE -> c.withoutOperator();
                case ALL -> c.count();
            };
            if (counted > 0) {
                String key = COUNTED.getOrDefault(c.level(), COUNTED.get(1));
                out.put(key, out.path(key).asLong(0) + counted);
            }
        }
        return out;
    }

    /**
     * The cases the list shows for {@code filters}, counted by condition, and the vehicles on a trip now.
     * {@code conditions} uses the GPS database's keys: without dates as {@link #withOpenCaseCounts} (under treatment
     * while it has an open treatment, else at its level; held cases in a separate Ignored bucket), with dates by
     * current level. The condition filter ({@code p_icu_code}) is left out, so every condition is counted; paging
     * is ignored.
     * {@code vehicles_on_trip} counts the vehicles on a trips-module trip that departed and has not ended, with the
     * trip filters (trip, vehicle, driver, carrier, origin, destination); dates and symptom do not apply to it.
     *
     * @param filters already checked by {@code ControlTowerMapService.symptomFilters}
     */
    public JsonNode filteredCounts(String tenantCode, Map<String, String> filters) {
        return filteredCounts(tenantCode, filters, Viewer.DEFAULT);
    }

    /** The filtered counters with the same explicit operator scope as the list. */
    public JsonNode filteredCounts(String tenantCode, Map<String, String> filters,
            EngineCaseStore.OperatorScope operator) {
        return filteredCounts(tenantCode, filters, Viewer.of(operator));
    }

    /**
     * The filtered counters for what {@code viewer} asks: {@code conditions} counts the cases in the viewer's
     * treatment state, as the list shows them. {@code treatment_states} counts the same cases by treatment state
     * ({@code untreated}, {@code in_treatment}, {@code treated}) without that filter, so each choice shows its size.
     */
    public JsonNode filteredCounts(String tenantCode, Map<String, String> filters, Viewer viewer) {
        Map<String, String> unlevelled = new HashMap<>(filters);
        unlevelled.remove(LEVEL);
        EngineCaseStore.CaseFilter filter = scoped(filter(unlevelled), viewer);
        ObjectNode out = JSON.objectNode();
        ObjectNode states = out.putObject("treatment_states");
        Map<EngineCase.TreatmentState, Long> byState = store.treatmentCounts(tenantCode, filter.treatment(null));
        for (EngineCase.TreatmentState state : EngineCase.TreatmentState.values()) {
            states.put(state.wire(), byState.getOrDefault(state, 0L));
        }
        ObjectNode conditions = out.putObject("conditions");
        for (EngineCaseStore.OpenCount c : store.matchingCounts(tenantCode, filter)) {
            String key = filter.openOnly() && c.underTreatment() ? COUNTED_UNDER_TREATMENT
                    : COUNTED.getOrDefault(c.level(), COUNTED.get(1));
            conditions.put(key, conditions.path(key).asLong(0) + c.count());
        }
        long ignored = store.matchingCounts(tenantCode, filter.withIgnored()).stream()
                .mapToLong(EngineCaseStore.OpenCount::count).sum();
        if (ignored > 0) {
            conditions.put(COUNTED_IGNORED, ignored);
        }
        out.put("vehicles_on_trip", store.vehiclesOnTrip(tenantCode, filter));
        return out;
    }

    /**
     * The positions with each vehicle's level from its open cases: {@code symptoms_condition} is the highest level
     * among them, 0 without one, and {@code associate_symptoms} lists them. The GPS database's own symptom fields
     * are dropped; {@code speed_limit_condition} stays, as null, so the map's speed filter keeps the vehicle.
     * A speed case's limit is added only when its transition is the live position's frame.
     */
    public JsonNode withCaseLevels(String tenantCode, JsonNode positions) {
        Map<String, List<EngineCaseStore.OpenLevel>> byAsset = new HashMap<>();
        store.openLevels(tenantCode).forEach(l -> byAsset.computeIfAbsent(l.assetId(), a -> new ArrayList<>())
                .add(l));
        ArrayNode out = JSON.arrayNode();
        if (positions == null || !positions.isArray()) {
            return out;
        }
        for (JsonNode p : positions) {
            if (!p.isObject()) {
                continue;
            }
            ObjectNode position = ((ObjectNode) p).deepCopy();
            String asset = position.hasNonNull(POSITION_ASSET_ID) ? position.get(POSITION_ASSET_ID).asText()
                    : position.path("assetid").asText(null);
            List<EngineCaseStore.OpenLevel> open = asset == null ? List.of() : byAsset.getOrDefault(asset, List.of());
            position.remove(List.of(SPEED_LIMIT, "speed_limit_source", "speed_limit_zone", "lost_signal",
                    "symptoms", "symptom_condition"));
            position.putNull("speed_limit_condition");
            position.put("symptoms_condition", open.stream().mapToInt(EngineCaseStore.OpenLevel::level).max()
                    .orElse(0));
            ArrayNode symptoms = position.putArray("associate_symptoms");
            open.forEach(l -> symptoms.addObject().put(SYMPTOM_NAME, l.name()).put(ICU_CONDITION, l.level()));
            // A case change's limit is evidence for that frame only, never for a newer live position.
            open.stream().map(EngineCaseStore.OpenLevel::speedStep).filter(java.util.Objects::nonNull)
                    .filter(s -> s.speedLimit() != null
                            && sameFrame(s.at(), position.path("timestamp").asText()))
                    .findFirst().ifPresent(s -> speed(position, s));
            out.add(position);
        }
        return out;
    }

    private static boolean sameFrame(Instant at, String timestamp) {
        try {
            return at.equals(Instant.parse(timestamp));
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    /**
     * The map's summary in the GPS database's shape. Only the symptom counts come from the cases (open ones, by
     * level); the service and fleet figures have no case equivalent and are 0, as is {@code stable_condition}.
     */
    public JsonNode summary(String tenantCode) {
        Map<Integer, Long> byLevel = new HashMap<>();
        store.openCounts(tenantCode).forEach(c -> byLevel.merge(Math.clamp(c.level(), 1, 4), c.count(),
                Long::sum));
        ObjectNode out = JSON.objectNode();
        ArrayNode sections = out.putArray("sections");
        section(sections, "services", List.of("trips", "emergencies", "in_transit", "at_destination",
                "monitoring_hours_hrs", "monitoring_distance_km"), Map.of());
        section(sections, "fleet", List.of("monitored_assets", "trucks", "signal_quality_trucks_spm",
                "signal_delay_trucks_sec", "container", "drivers"), Map.of());
        section(sections, "symptoms", List.of("stable_condition", "under_observation", "compromised_condition",
                "critical_condition", "black code"), Map.of("under_observation", byLevel.getOrDefault(1, 0L),
                        "compromised_condition", byLevel.getOrDefault(2, 0L), "critical_condition",
                        byLevel.getOrDefault(3, 0L), "black code", byLevel.getOrDefault(4, 0L)));
        return out;
    }

    private static void section(ArrayNode sections, String title, List<String> keys, Map<String, Long> values) {
        ObjectNode section = sections.addObject();
        section.put("title", title);
        section.put("icon", "example.svg");
        ArrayNode items = section.putArray("items");
        keys.forEach(k -> items.addObject().put("key", k).put("value", values.getOrDefault(k, 0L)));
    }

    /**
     * The task form's symptom card for one trip: each ACTIVE symptom of the organization, and any other with a
     * case there, with the cases it opened on the trip. {@code trip} is a trip id or the client's service code.
     * {@code max_condition} is null without cases.
     *
     * @throws IllegalArgumentException when {@code trip} is blank
     */
    public JsonNode tripSymptoms(String tenantCode, String trip) {
        if (trip == null || trip.isBlank()) {
            throw new IllegalArgumentException("A trip id or service code is required");
        }
        String given = trip.trim();
        ObjectNode out = JSON.objectNode();
        out.put("trip", given);
        ArrayNode symptoms = out.putArray("symptoms");
        for (EngineCaseStore.TripSymptom s : store.tripSymptoms(tenantCode, given)) {
            ObjectNode row = symptoms.addObject();
            row.put("definition_id", s.definitionId() == null ? null : s.definitionId().toString());
            row.put("symptom_key", s.symptomKey());
            row.put("name", s.name());
            row.put("family", s.family());
            row.put("icon", s.icon());
            row.put("cases", s.cases());
            row.put("open_cases", s.openCases());
            row.put("max_level", s.maxLevel());
            row.put("max_condition", s.cases() > 0 && s.maxLevel() > 0 ? condition(s.maxLevel()) : null);
            row.put("trip_id", s.tripId());
            row.put("first_opened_at", s.firstAt() == null ? null : s.firstAt().toString());
            row.put("last_opened_at", s.lastAt() == null ? null : s.lastAt().toString());
        }
        return out;
    }

    public boolean hasOpenCases(String tenantCode) {
        return !store.open(tenantCode).isEmpty();
    }

    private ObjectNode row(EngineCase c, String actor) {
        ObjectNode r = JSON.objectNode();
        r.put("id", c.symptomId());
        r.put(SYMPTOM_NAME, c.name());
        r.put("type_of_incidence", c.name());
        r.put(ICU_CODE, String.valueOf(c.level()));
        r.put(ICU_CONDITION, c.treatments() > 0 ? UNDER_TREATMENT : condition(c.level()));
        r.put(POSITION_ASSET_ID, c.assetId());
        r.put("trip_id", c.tripId());
        r.put("trip_code", c.tripCode());
        r.put("start_time", c.openedAt().toString());
        if (c.closedAt() != null) {
            r.put("end_time", c.closedAt().toString());
        }
        Instant until = c.closedAt() != null ? c.closedAt() : clock.instant();
        r.put("duration_sec", Duration.between(c.openedAt(), until).toSeconds());
        r.put("treatment_count", c.treatments());
        r.put("sla_minutes", c.slaMinutes());
        r.put("sla_since", c.slaStart().toString());
        r.put("recurrence_events", c.recurrence());
        r.put("operator_required", c.operatorRequired());
        EngineCase.TripDetails trip = c.trip();
        r.put(DRIVER_FIELD, trip == null ? null : trip.driver());
        r.put(CARRIER_FIELD, trip == null ? null : trip.carrier());
        r.put(ORIGIN_FIELD, trip == null ? null : trip.origin());
        r.put(DESTINATION_FIELD, trip == null ? null : trip.destination());
        r.put(TRIP_ASSET_ID, trip == null ? null : trip.assetId());
        putHold(r, c);
        putTreatment(r, c, actor);
        return r;
    }

    /**
     * {@code treatment_state} ({@code untreated}, {@code in_treatment} or {@code treated}) and {@code treatment}:
     * the episode the state is about ({@link EngineCase.CaseTreatment#shown}), or null without one. {@code status}
     * is OPEN or CLOSED; {@code outcome} how a closed one handled the case; {@code operators} who has it open now;
     * {@code mine} whether {@code actor} is one of them.
     */
    private static void putTreatment(ObjectNode out, EngineCase c, String actor) {
        out.put("treatment_state", c.treatmentState().wire());
        EngineCase.CaseTreatment read = c.treatment();
        EngineCase.Episode e = read == null ? null : read.shown(actor);
        if (e == null) {
            out.putNull("treatment");
            return;
        }
        ObjectNode t = out.putObject("treatment");
        t.put("id", e.id());
        t.put("status", e.closedAt() == null && c.treatmentState() == EngineCase.TreatmentState.IN_TREATMENT
                ? TreatmentStatus.OPEN.name() : TreatmentStatus.CLOSED.name());
        t.put("type", e.type());
        t.put("outcome", e.outcome());
        t.put("outcome_label", e.outcomeLabel());
        t.put("resolution", e.resolution());
        t.put("opened_by", e.openedBy());
        t.put(OPENED_AT, e.openedAt() == null ? null : e.openedAt().toString());
        t.put("closed_by", e.closedBy());
        t.put("closed_at", e.closedAt() == null ? null : e.closedAt().toString());
        boolean inTreatment = c.treatmentState() == EngineCase.TreatmentState.IN_TREATMENT;
        t.put("mine", inTreatment && read.openBy(actor));
        ArrayNode operators = t.putArray("operators");
        if (inTreatment) {
            read.open().stream().map(EngineCase.Episode::openedBy).filter(java.util.Objects::nonNull).distinct()
                    .forEach(operators::add);
        }
    }

    /**
     * {@code ignored}: the hold that covers the case, with {@code until} null while it lasts until the trip ends;
     * {@code returned_after_ignore_at}: when the case came back to the tower from its latest hold ("Vuelve tras
     * ignorar"), while it is open and not held again.
     */
    private static void putHold(ObjectNode out, EngineCase c) {
        EngineCase.Ignored h = c.ignored();
        if (h != null && c.closedAt() == null) {
            ObjectNode ignored = out.putObject("ignored");
            ignored.put("treatment_id", h.treatmentId());
            ignored.put("since", h.since().toString());
            ignored.put("until", h.until() == null ? null : h.until().toString());
            ignored.put("until_trip_end", h.untilTripEnd());
            ignored.put("scope", h.scope());
            ignored.put("by", h.by());
        } else if (c.returnedAt() != null && c.closedAt() == null) {
            out.put("returned_after_ignore_at", c.returnedAt().toString());
        }
    }

    /** The RUTs of the case's live trip (drivers and carrier) and its origin and destination. Empty without one. */
    public TripPeople tripPeople(String tenantCode, long symptomId) {
        EngineCase c = find(tenantCode, symptomId);
        Row t = c.tripId() == null ? null : trips.apply(Tuple.of(tenantCode, c.tripId(), c.assetId()));
        if (t == null) {
            return TripPeople.NONE;
        }
        return TripPeople.of(t.getString(DRIVER_ID), t.getString(SECOND_DRIVER_ID), t.getString(CARRIER_TAX_ID))
                .withRoute(TripRoute.of(t.getString(ORIGIN_LABEL), t.getInteger("origin_geofence_id"),
                        t.getString(DESTINATION_LABEL), t.getInteger("destination_geofence_id")));
    }

    /** The most recent cases {@link #scriptSamples} offers. */
    static final int MAX_SCRIPT_SAMPLES = 10;

    /**
     * What an operator step's script reads, by case: {@code case} (the symptom, level and where the vehicle was),
     * {@code condition} (what the rules read when the case reached its level), {@code trip} (route, load, drivers
     * and carrier, while the trip is live) and {@code vehicle}. A script writes them as {@code {{trip.driver.name}}}.
     */
    public JsonNode context(String tenantCode, long symptomId) {
        return context(tenantCode, find(tenantCode, symptomId));
    }

    /**
     * The newest cases of a symptom, each with its {@link #context}, so a script can be read with real data while
     * it is written. Cases at {@code level} come first when given.
     */
    public JsonNode scriptSamples(String tenantCode, String symptomName, Integer level) {
        if (symptomName == null || symptomName.isBlank()) {
            throw new IllegalArgumentException("symptom is required");
        }
        EngineCaseStore.CaseFilter filter = filter(Map.of(NAME, symptomName, TO, clock.instant().toString()));
        List<EngineCase> found = new ArrayList<>(store.list(tenantCode, filter));
        found.sort(java.util.Comparator
                .comparing((EngineCase c) -> level != null && c.level() == level ? 0 : 1)
                .thenComparing(EngineCase::openedAt, java.util.Comparator.reverseOrder()));
        ArrayNode out = JSON.arrayNode();
        found.stream().limit(MAX_SCRIPT_SAMPLES).forEach(c -> {
            ObjectNode sample = out.addObject();
            sample.put(SYMPTOM_ID, c.symptomId());
            sample.put(POSITION_ASSET_ID, c.assetId());
            sample.put(ICU_CODE, c.level());
            sample.put(OPENED_AT, c.openedAt().toString());
            sample.set(CONTEXT_FIELD, context(tenantCode, find(tenantCode, c.symptomId())));
        });
        return out;
    }

    private ObjectNode context(String tenantCode, EngineCase c) {
        ObjectNode out = JSON.objectNode();
        ObjectNode kase = out.putObject("case");
        kase.put("id", c.symptomId());
        kase.put("symptom", c.name());
        kase.put("family", c.family());
        kase.put(LEVEL_FIELD, c.level());
        kase.put("levelName", condition(c.level()));
        kase.put("openedAt", c.openedAt().toString());
        kase.put("slaMinutes", c.slaMinutes());
        kase.put("latitude", c.latitude());
        kase.put("longitude", c.longitude());
        kase.put("speedKmh", c.speedKmh());
        JsonNode reached = c.levelContext() != null ? c.levelContext() : c.openingContext();
        out.set("condition", reached == null ? JSON.objectNode() : reached.deepCopy());
        ObjectNode vehicle = out.putObject("vehicle");
        vehicle.put("plate", c.assetId());
        ObjectNode trip = out.putObject("trip");
        trip.put("id", c.tripId());
        trip.put("code", c.tripCode());
        Row t = c.tripId() == null ? null : trip(tenantCode, c);
        if (t != null) {
            trip.put(ORIGIN_FIELD, t.getString(ORIGIN_LABEL));
            trip.put(DESTINATION_FIELD, t.getString(DESTINATION_LABEL));
            trip.put("load", t.getString(TYPE_LOAD));
            trip.putObject(DRIVER_FIELD)
                    .put("name", t.getString("driver_name"))
                    .put("rut", t.getString(DRIVER_ID))
                    .put("phone", t.getString("driver_contact_phone"));
            trip.putObject("secondDriver")
                    .put("name", t.getString("second_driver_name"))
                    .put("rut", t.getString(SECOND_DRIVER_ID));
            trip.putObject(CARRIER_FIELD)
                    .put("name", t.getString("carrier_name"))
                    .put("rut", t.getString(CARRIER_TAX_ID));
        }
        return out;
    }

    /**
     * A case's life as one ordered list, for the response editor's timeline preview: {@code OPENED},
     * {@code LEVEL_CHANGED}, {@code NOTED} (the note rule's entries), {@code HELD} (an "Ignorar condición" hold),
     * {@code ACTION} (each operator action) and {@code CLOSED} with what the rules read when it closed. Entries at
     * the same time keep that order.
     */
    public JsonNode timeline(String tenantCode, long symptomId, List<TreatmentView> treatments) {
        EngineCase c = find(tenantCode, symptomId);
        List<ObjectNode> entries = new ArrayList<>();
        List<EngineCase.LevelStep> steps = c.levels();
        entries.add(entry("OPENED", c.openedAt()).put(LEVEL_FIELD, steps.isEmpty() ? c.level() : steps.get(0).level()));
        for (int i = 1; i < steps.size(); i++) {
            entries.add(entry("LEVEL_CHANGED", steps.get(i).at()).put(LEVEL_FIELD, steps.get(i).level())
                    .put("previousLevel", steps.get(i - 1).level()));
        }
        for (EngineCaseStore.CaseNote n : store.notes(tenantCode, c.id())) {
            entries.add(entry("NOTED", n.recordedAt()).put("eventType", n.eventType())
                    .put(DESCRIPTION, n.description()));
        }
        Instant until = c.closedAt() != null ? c.closedAt() : clock.instant();
        for (EngineCase.Ignored h : store.holds(tenantCode, c, until)) {
            Instant starts = h.since().isBefore(c.openedAt()) ? c.openedAt() : h.since();
            ObjectNode held = entry("HELD", starts).put("by", h.by()).put("untilTripEnd", h.untilTripEnd());
            held.put("until", h.until() == null ? null : h.until().toString());
            entries.add(held);
        }
        addTreatmentActions(entries, treatments);
        if (c.closedAt() != null) {
            ObjectNode closed = entry("CLOSED", c.closedAt());
            closed.set(CONTEXT_FIELD, c.closingContext() == null ? JSON.nullNode() : c.closingContext().deepCopy());
            entries.add(closed);
        }
        ArrayNode out = JSON.arrayNode();
        entries.stream()
                .sorted(java.util.Comparator.comparing((ObjectNode e) -> Instant.parse(e.path("at").asText())))
                .forEach(out::add);
        return out;
    }

    private static void addTreatmentActions(List<ObjectNode> entries, List<TreatmentView> treatments) {
        for (TreatmentView t : treatments == null ? List.<TreatmentView>of() : treatments) {
            for (TreatmentAction a : t.actions()) {
                entries.add(entry("ACTION", a.performedAt().toInstant()).put("action", a.kind().name())
                        .put("by", a.performedBy()).put("contact", a.contactName())
                        .put("outcome", a.outcomeLabel()));
            }
        }
    }

    private static ObjectNode entry(String kind, Instant at) {
        ObjectNode e = JSON.objectNode();
        e.put("kind", kind);
        e.put("at", at.toString());
        return e;
    }

    /** The treatment page's header: the case, and its trip when it had one. */
    public JsonNode header(String tenantCode, long symptomId) {
        return header(tenantCode, symptomId, null);
    }

    /** As {@link #header(String, long)}; {@code symptom_info.treatment.mine} is about {@code actor}. */
    public JsonNode header(String tenantCode, long symptomId, String actor) {
        EngineCase c = find(tenantCode, symptomId);
        ObjectNode out = JSON.objectNode();
        out.set(CONDITIONS_AGG, JSON.arrayNode());
        // One timeline entry per case of the trip, oldest first; the map selects the current one to load its point.
        Instant started = start(c);
        Instant ended = end(c);
        String start = started.toString();
        ArrayNode timeline = out.putArray(TIMELINE);
        for (EngineCase other : tripCases(tenantCode, c)) {
            addTimelineEntry(timeline, tenantCode, other, other.id() == c.id());
        }
        ObjectNode symptom = out.putObject("symptom_info");
        symptom.put("id", c.symptomId());
        symptom.put("name", c.name());
        symptom.put("type", c.family());
        symptom.put(ICU_CODE, c.level());
        symptom.put(ICU_CONDITION, condition(c.level()));
        symptom.put(OPENED_AT, c.openedAt().toString());
        symptom.put("sla_since", c.slaStart().toString());
        symptom.put("sla_minutes", c.slaMinutes());
        symptom.put("started_at", start);
        symptom.put("duration_sec", Duration.between(started, ended).toSeconds());
        putHold(symptom, c);
        putTreatment(symptom, c, actor);
        symptom.put("closed_at", c.closedAt() == null ? null : c.closedAt().toString());
        out.set("level_reason", levelReason(c));
        putMapWindow(out.putObject("map_window"), signalWindow(tenantCode, c), started, ended);
        out.set("level_response", c.levelResponse() == null ? JSON.nullNode() : c.levelResponse());
        ObjectNode trip = out.putObject("trip_info");
        trip.put(POSITION_ASSET_ID, c.assetId());
        trip.put(TRIP_ASSET_ID, c.trip() == null ? null : c.trip().assetId());
        trip.put("trip_id", c.tripId());
        trip.put("trip_code", c.tripCode());
        Row t = c.tripId() == null ? null : trip(tenantCode, c);
        if (t != null) {
            trip.put(CARRIER_FIELD, t.getString("carrier_name"));
            trip.put(CARRIER_TAX_ID, t.getString(CARRIER_TAX_ID));
            trip.put("driver_rut", t.getString(DRIVER_ID));
            trip.put("second_driver_rut", t.getString(SECOND_DRIVER_ID));
            trip.put(ORIGIN_FIELD, t.getString(ORIGIN_LABEL));
            trip.put(DESTINATION_FIELD, t.getString(DESTINATION_LABEL));
            trip.put(DRIVER_FIELD, t.getString("driver_name"));
            trip.put("driver2", t.getString("second_driver_name"));
            trip.put(TYPE_LOAD, t.getString(TYPE_LOAD));
            trip.put("driver_contact", t.getString("driver_contact_phone"));
        }
        return out;
    }

    /** At most this many cases of the trip are in a case's timeline: the latest, with the case itself. */
    static final int MAX_TRIP_CASES = 100;

    /**
     * The case and the other ACTIVE cases of its trip, of any symptom, ordered by when their condition began; only
     * the case when it has no trip.
     */
    private List<EngineCase> tripCases(String tenantCode, EngineCase c) {
        List<EngineCase> all = new ArrayList<>();
        all.add(c);
        if (c.tripId() != null) {
            store.tripCases(tenantCode, c.tripId(), MAX_TRIP_CASES).stream()
                    .filter(o -> o.id() != c.id()).forEach(all::add);
            if (all.size() > MAX_TRIP_CASES) {
                all.sort(Comparator.comparing(EngineCase::openedAt).reversed());
                List<EngineCase> kept = new ArrayList<>(all.subList(0, MAX_TRIP_CASES));
                if (kept.stream().noneMatch(o -> o.id() == c.id())) {
                    kept.set(MAX_TRIP_CASES - 1, c);
                }
                all = kept;
            }
        }
        all.sort(Comparator.comparing(EngineCaseService::start).thenComparing(EngineCase::id));
        return all;
    }

    /**
     * One case's timeline entry: its time, symptom, one block per level step with the note rule's entries, and
     * {@code current} for the case the page is about.
     */
    private void addTimelineEntry(ArrayNode timeline, String tenantCode, EngineCase c, boolean current) {
        Instant started = start(c);
        Instant ended = end(c);
        ObjectNode entry = timeline.addObject();
        entry.put(START, started.toString());
        entry.put("end", ended.toString());
        entry.put(SYMPTOM_ID, c.symptomId());
        entry.put(SYMPTOM_NAME, c.name());
        entry.put(CURRENT, current);
        entry.put("closed_at", c.closedAt() == null ? null : c.closedAt().toString());
        ArrayNode levelAggs = entry.putArray(CONDITIONS_AGG);
        addLevelAggs(levelAggs, c, started, ended);
        addNotes(levelAggs, store.notes(tenantCode, c.id()));
    }

    /**
     * The note rule's entries, each in the level step whose time holds the frame that wrote it, as treatments are
     * placed ({@link #withTreatments}).
     */
    static void addNotes(ArrayNode levelAggs, List<EngineCaseStore.CaseNote> notes) {
        List<ObjectNode> aggs = new ArrayList<>();
        levelAggs.forEach(agg -> aggs.add((ObjectNode) agg));
        if (aggs.isEmpty()) {
            return;
        }
        for (EngineCaseStore.CaseNote n : notes) {
            int step = stepOf(aggs, n.recordedAt().atOffset(java.time.ZoneOffset.UTC));
            ((ArrayNode) aggs.get(step).get(TREATMENTS)).add(noteRow(n));
        }
    }

    private static ObjectNode noteRow(EngineCaseStore.CaseNote n) {
        ObjectNode row = JSON.objectNode();
        row.put(TREATMENT_TYPE, NOTE_TYPE);
        row.put("event_type", n.eventType());
        row.put("at", n.at().toString());
        row.putNull("by");
        ObjectNode description = row.putObject(DESCRIPTION);
        description.put(MESSAGE, n.description() != null ? n.description() : n.eventType());
        description.putNull(DRIVER_RESPONSE);
        return row;
    }

    /** Keep transition order while bounding times from different clocks to the case interval. */
    private static void addLevelAggs(ArrayNode aggs, EngineCase c, Instant start, Instant end) {
        List<EngineCase.LevelStep> steps = c.levels();
        if (steps.isEmpty()) {
            addAgg(aggs, c, start.toString(), end.toString(), c.level());
            return;
        }
        Instant from = start;
        for (int i = 0; i < steps.size(); i++) {
            Instant to = i + 1 < steps.size() ? steps.get(i + 1).at() : end;
            if (to.isBefore(from)) {
                to = from;
            }
            if (to.isAfter(end)) {
                to = end;
            }
            addAgg(aggs, c, from.toString(), to.toString(), steps.get(i).level());
            from = to;
        }
    }

    private static void addAgg(ArrayNode aggs, EngineCase c, String start, String end, int level) {
        ObjectNode agg = aggs.addObject();
        agg.put(START, start);
        agg.put("end", end);
        agg.put(SYMPTOM_ID, c.symptomId());
        agg.put("is_symptom", 1);
        agg.put("type", c.name());
        agg.put("symptom_description", c.name());
        agg.put(ICU_CODE, String.valueOf(level));
        agg.put(ICU_CONDITION, condition(level));
        agg.put("count", 1);
        agg.putNull("assigned_to");
        agg.set(TREATMENTS, JSON.arrayNode());
        agg.putNull("evidences");
    }

    /**
     * When the case's condition began: for a lost signal, the last frame before the silence, which comes before
     * the case opens; else when it opened.
     */
    static Instant start(EngineCase c) {
        Instant lost = lostSince(c.openingContext());
        return lost != null && lost.isBefore(c.openedAt()) ? lost : c.openedAt();
    }

    /** When the case closed, or now while it is open. */
    private Instant end(EngineCase c) {
        Instant now = clock.instant();
        Instant end = c.closedAt() != null ? c.closedAt() : now;
        return end.isBefore(start(c)) ? start(c) : end;
    }

    /** The last frame before a lost signal ({@code check.loss.last.at}), or null. */
    static Instant lostSince(JsonNode context) {
        JsonNode at = context == null ? null : context.path(CHECK).path("loss").path("last").path("at");
        return contextInstant(at);
    }

    private static Instant contextInstant(JsonNode at) {
        if (at == null || !at.isTextual()) {
            return null;
        }
        try {
            return Instant.parse(at.asText());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * Why the case is at its level: the level, its rule, and what the rules read when the case reached it
     * ({@code context}, null when it was not kept). For a lost signal, {@code lost_since}. {@code levels} has the
     * level of each change, oldest first, so the map can color a frame by the level at its time.
     */
    private static ObjectNode levelReason(EngineCase c) {
        ObjectNode reason = JSON.objectNode();
        reason.put(ICU_CODE, c.level());
        reason.put(ICU_CONDITION, condition(c.level()));
        reason.put("rule", c.levelRule());
        reason.set(CONTEXT_FIELD, c.levelContext() == null ? JSON.nullNode() : c.levelContext().deepCopy());
        Instant lost = lostSince(c.openingContext());
        if (lost != null) {
            reason.put("lost_since", lost.toString());
        }
        ArrayNode levels = reason.putArray("levels");
        c.levels().forEach(step -> speed(levels.addObject().put("at", step.at().toString())
                .put(ICU_CODE, step.level()), step));
        return reason;
    }

    /** Where the vehicle was when the case's condition began, as a FeatureCollection with an EWKB point. */
    public JsonNode signals(String tenantCode, long symptomId) {
        EngineCase c = find(tenantCode, symptomId);
        ObjectNode out = JSON.objectNode();
        out.put("type", "FeatureCollection");
        out.put("closed", c.closedAt() != null);
        ArrayNode features = out.putArray("features");
        if (c.latitude() != null && c.longitude() != null) {
            ObjectNode f = features.addObject();
            f.put("type", "Feature");
            f.put("geometry", ewkbPoint(c.longitude(), c.latitude()));
            ObjectNode props = f.putObject("properties");
            props.put("speed", c.speedKmh() == null ? 0 : c.speedKmh());
            props.put("timestamp", start(c).toString());
            props.put(ICU_CODE, c.level());
            if (!c.levels().isEmpty()) {
                speed(props, c.levels().get(0));
            }
        }
        out.set(DESCRIPTION, description(c, end(c), reported(c), clock.instant()));
        return out;
    }

    /** A failed read leaves the popup without the profile's lines. */
    private Optional<Reported> reported(EngineCase c) {
        try {
            return vehicles.reported(c.assetId(), clock.instant());
        } catch (RuntimeException e) {
            LOG.debugf("Engine case: vehicle profile not read (%s)", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    /**
     * The map popup's lines, with the GPS database's names and formats. A lost signal (a {@code trip_check}
     * case) adds {@code signal_lag}: while open, now minus the GPS time of the vehicle's newest frame; once
     * closed, the silence the closing check read (from the last frame before the loss to the one that returned,
     * or {@code check.loss.silence_s} when it did not return), or nothing without a closing context. Any case
     * adds the vehicle's usual report interval ({@code median_report_interval}) and the newest frame's engine
     * status when the detector has a profile; a lost signal falls back to the engine its checks read.
     */
    static ObjectNode description(EngineCase c, Instant end, Optional<Reported> reported, Instant now) {
        ObjectNode d = JSON.objectNode();
        d.put(SYMPTOM_NAME, c.name());
        d.put(ICU_CODE, c.level());
        d.put("first_signal_timestamp", start(c).toString());
        d.put("last_signal_timestamp", end.toString());
        if (c.speedKmh() != null) {
            d.put("last_reported_speed", c.speedKmh());
        }
        if (!c.levels().isEmpty()) {
            speed(d, c.levels().get(c.levels().size() - 1));
        }
        boolean lost = c.openingContext() != null && c.openingContext().path(CHECK).path("loss").isObject();
        Long lag = lost ? signalLag(c, reported, now) : null;
        if (lag != null) {
            d.put("signal_lag", hms(lag));
        }
        reported.map(Reported::medianIntervalS).ifPresent(s -> d.put("median_report_interval", hms(s)));
        Boolean engine = reported.map(Reported::engineOn).orElse(null);
        if (engine == null && lost) {
            engine = contextEngine(c.closingContext(), c.levelContext(), c.openingContext()).orElse(null);
        }
        if (engine != null) {
            d.put("last_reported_engine_status", engine);
        }
        return d;
    }

    /**
     * A speed case's change as the map's speed lines read it, with the GPS database's names: {@code speed} and
     * {@code speed_limit} in km/h, so the excess is their difference, plus {@code speed_limit_source} ({@code road}
     * or {@code custom}) and the own limit's zone name as {@code speed_limit_zone}. Nothing for other symptoms.
     */
    static void speed(ObjectNode out, EngineCase.LevelStep step) {
        if (step.speedKmh() == null) {
            return;
        }
        kmh(out, "speed", step.speedKmh());
        EngineCase.SpeedLimit limit = step.speedLimit();
        if (limit != null) {
            kmh(out, SPEED_LIMIT, limit.kmh());
            out.put("speed_limit_source", limit.source());
            if (limit.zone() != null) {
                out.put("speed_limit_zone", limit.zone());
            }
        }
    }

    private static void kmh(ObjectNode out, String field, double kmh) {
        if (kmh == Math.rint(kmh)) {
            out.put(field, (long) kmh);
        } else {
            out.put(field, kmh);
        }
    }

    private static Long signalLag(EngineCase c, Optional<Reported> reported, Instant now) {
        if (c.closedAt() == null) {
            Instant last = reported.map(r -> r.state().lastFrameAt()).orElse(null);
            return last == null ? null : Math.max(0, Duration.between(last, now).toSeconds());
        }
        JsonNode loss = c.closingContext() == null ? null : c.closingContext().path(CHECK).path("loss");
        if (loss == null || !loss.isObject()) {
            return null;
        }
        if (loss.path("returned").asBoolean(false)) {
            Instant lostSince = lostSince(c.openingContext());
            Instant back = contextInstant(loss.path("returned_frame_at"));
            return lostSince != null && back != null && back.isAfter(lostSince)
                    ? Duration.between(lostSince, back).toSeconds() : null;
        }
        return loss.path("silence_s").isNumber() ? Math.round(loss.path("silence_s").asDouble()) : null;
    }

    private static Optional<Boolean> contextEngine(JsonNode... contexts) {
        for (JsonNode context : contexts) {
            JsonNode engine = context == null ? null
                    : context.path(CHECK).path("loss").path("last").path("engine");
            if (engine != null && engine.isBoolean()) {
                return Optional.of(engine.asBoolean());
            }
        }
        return Optional.empty();
    }

    /** Seconds as the GPS database writes intervals: HH:MM:SS, hours past 24 kept. */
    static String hms(long seconds) {
        long s = Math.max(0, seconds);
        return String.format(java.util.Locale.ROOT, "%02d:%02d:%02d", s / 3600, s % 3600 / 60, s % 60);
    }

    /**
     * The header with the case's treatments in its timeline entry ({@code current}), one row per call, ignore or
     * invalidate action, in the shape of the GPS database's treatments. Each action goes in the level step whose
     * time holds it; one before the first step goes in the first, one after the last in the last. A handling record
     * ("Registrar gestión") shows as {@code registrar gestion}. Cancelled treatments and other notes are left out.
     */
    public static JsonNode withTreatments(JsonNode header, List<TreatmentView> treatments) {
        for (JsonNode entry : header.path(TIMELINE)) {
            if (entry.path(CURRENT).asBoolean(true)) {
                return withTreatments(header, Map.of(entry.path(SYMPTOM_ID).asLong(), treatments));
            }
        }
        return header.deepCopy();
    }

    /** As {@link #withTreatments(JsonNode, List)}, each timeline entry with its case's treatments, by symptom id. */
    public static JsonNode withTreatments(JsonNode header, Map<Long, List<TreatmentView>> bySymptom) {
        ObjectNode out = header.deepCopy();
        out.path(TIMELINE).forEach(entry -> {
            List<ObjectNode> aggs = new ArrayList<>();
            entry.path(CONDITIONS_AGG).forEach(agg -> aggs.add((ObjectNode) agg));
            addTreatments(aggs, bySymptom.getOrDefault(entry.path(SYMPTOM_ID).asLong(), List.of()));
        });
        return out;
    }

    /** The symptom ids of the header's timeline entries: the cases whose treatments it shows. */
    public static List<Long> timelineSymptomIds(JsonNode header) {
        List<Long> ids = new ArrayList<>();
        header.path(TIMELINE).forEach(entry -> ids.add(entry.path(SYMPTOM_ID).asLong()));
        return ids;
    }

    private static void addTreatments(List<ObjectNode> aggs, List<TreatmentView> treatments) {
        List<ArrayNode> rows = new ArrayList<>();
        // A step is assigned to whoever treated the case during it; a step with no treatment has nobody.
        List<String> assignees = new ArrayList<>();
        // The header's own entries (the note rule's) stay; treatments follow them.
        aggs.forEach(agg -> {
            rows.add(agg.path(TREATMENTS) instanceof ArrayNode kept ? kept.deepCopy() : JSON.arrayNode());
            assignees.add(null);
        });
        for (TreatmentView t : treatments) {
            if (t.status() == TreatmentStatus.CANCELLED || aggs.isEmpty()) {
                continue;
            }
            String operator = t.closedBy() != null ? t.closedBy() : t.openedBy();
            t.actions().stream().filter(EngineCaseService::includedInHistory).forEach(a -> {
                int step = stepOf(aggs, a.performedAt());
                rows.get(step).add(timelineRow(a));
                assignees.set(step, a.performedBy() != null ? a.performedBy() : t.openedBy());
            });
            if (t.status() == TreatmentStatus.CLOSED && t.resolution() != null
                    && HoldService.ENDINGS.contains(t.resolution())
                    && t.actions().stream().anyMatch(a -> a.kind() == ActionKind.IGNORE)) {
                int step = stepOf(aggs, t.closedAt());
                rows.get(step).add(holdEnd(t));
                assignees.set(step, operator);
            }
        }
        for (int i = 0; i < aggs.size(); i++) {
            aggs.get(i).set(TREATMENTS, rows.get(i));
            aggs.get(i).put("assigned_to", assignees.get(i));
        }
    }

    private static boolean includedInHistory(TreatmentAction action) {
        return action.kind() != ActionKind.NOTE || action.recordsHandling();
    }

    /** The index of the last agg that starts at or before {@code when}; the first when none does. */
    private static int stepOf(List<ObjectNode> aggs, OffsetDateTime when) {
        if (when == null) {
            return aggs.size() - 1;
        }
        Instant at = when.toInstant();
        int found = 0;
        for (int i = 1; i < aggs.size(); i++) {
            Instant start = contextInstant(aggs.get(i).path(START));
            if (start != null && !start.isAfter(at)) {
                found = i;
            }
        }
        return found;
    }

    private static ObjectNode timelineRow(TreatmentAction a) {
        ObjectNode row = JSON.objectNode();
        ObjectNode description = row.putObject(DESCRIPTION);
        if (a.kind() == ActionKind.CALL) {
            row.put(TREATMENT_TYPE, "llamar al conductor");
            description.put(MESSAGE, a.message() != null ? a.message() : "Llamado a: " + a.contactName());
            description.put(DRIVER_RESPONSE, joined(a.outcomeLabel(), a.note()));
        } else {
            row.put(TREATMENT_TYPE, otherTreatmentType(a.kind()));
            description.put(MESSAGE, a.outcomeLabel() != null ? a.outcomeLabel() : a.outcomeKey());
            description.put(DRIVER_RESPONSE, a.note());
        }
        row.put("at", a.performedAt() == null ? null : a.performedAt().toInstant().toString());
        row.put("by", a.performedBy());
        if (a.kind() == ActionKind.IGNORE) {
            boolean tripEnd = Boolean.TRUE.equals(details(a).get(HoldService.UNTIL_TRIP_END));
            row.put("until_trip_end", tripEnd);
            row.put("ignored_until", tripEnd || a.performedAt() == null || a.durationSeconds() == null ? null
                    : a.performedAt().toInstant().plusSeconds(a.durationSeconds()).toString());
            Object scope = details(a).get(HoldService.SCOPE);
            row.put("scope", scope == null ? null : scope.toString());
        }
        return row;
    }

    private static String otherTreatmentType(ActionKind kind) {
        return switch (kind) {
            case IGNORE -> "ignorar condicion";
            case NOTE -> "registrar gestion";
            default -> "invalidar sintoma";
        };
    }

    private static Map<String, Object> details(TreatmentAction a) {
        return a.details() == null ? Map.of() : a.details();
    }

    /**
     * The end of a hold: {@code resolution} says how (resolved after ignore, back in the tower, or closed with the
     * trip), {@code by} who lifted it ({@value HoldService#SYSTEM} when its time ran out).
     */
    private static ObjectNode holdEnd(TreatmentView t) {
        ObjectNode row = JSON.objectNode();
        row.put(TREATMENT_TYPE, "fin de ignorar");
        row.put("resolution", t.resolution());
        row.put("at", t.closedAt() == null ? null : t.closedAt().toInstant().toString());
        row.put("by", t.closedBy());
        ObjectNode description = row.putObject(DESCRIPTION);
        description.put(MESSAGE, t.resolution());
        description.putNull(DRIVER_RESPONSE);
        return row;
    }

    private static String joined(String first, String second) {
        if (first == null || first.isBlank()) {
            return second;
        }
        return second == null || second.isBlank() ? first : first + " · " + second;
    }

    /** The vehicle and the time range of the signals the treatment page shows for a case. */
    public record SignalWindow(String assetId, Instant from, Instant to, boolean onTrip) {
        public SignalWindow(String assetId, Instant from, Instant to) {
            this(assetId, from, to, false);
        }
    }

    /**
     * From an hour before the case's condition began, or from the vehicle's previous case when that opened later,
     * until the case closed or now; at most {@link #SIGNALS_AT_MOST} after the start. A case on a trips-module trip
     * uses the trip's bounded range ({@link TripWindows#track}), and {@code onTrip} is true. The case's own time
     * remains in the header and timeline, even when it falls outside that range.
     */
    public SignalWindow signalWindow(String tenantCode, long symptomId) {
        return signalWindow(tenantCode, find(tenantCode, symptomId));
    }

    private SignalWindow signalWindow(String tenantCode, EngineCase c) {
        return tripTrack(tenantCode, c)
                .map(t -> new SignalWindow(c.assetId(), t.from(), t.to(), true))
                .orElseGet(() -> caseSignalWindow(tenantCode, c));
    }

    private Optional<TripWindows.Window> tripTrack(String tenantCode, EngineCase c) {
        if (c.tripId() == null) {
            return Optional.empty();
        }
        try {
            return tripTracks.track(tenantCode, c.tripId(), c.assetId());
        } catch (RuntimeException e) {
            LOG.debugf("Engine case %d: trip range unavailable (%s)", c.id(), e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    /**
     * {@code track_from}/{@code track_to}: the range of the positions the map draws ({@link #signalWindow}), the
     * trip's when {@code on_trip}; {@code case_from}/{@code case_to}: the case's own time, whose signals the map
     * highlights.
     */
    private static void putMapWindow(ObjectNode out, SignalWindow track, Instant caseFrom, Instant caseTo) {
        out.put("track_from", track.from().toString());
        out.put("track_to", track.to().toString());
        out.put("on_trip", track.onTrip());
        out.put("case_from", caseFrom.toString());
        out.put("case_to", caseTo.toString());
    }

    private SignalWindow caseSignalWindow(String tenantCode, EngineCase c) {
        Instant opened = start(c);
        Instant earliest = opened.minus(SIGNALS_BEFORE);
        Instant from = store.previousOpening(tenantCode, c.assetId(), c.id(), earliest, opened).orElse(earliest);
        Instant end = c.closedAt() != null ? c.closedAt() : clock.instant();
        Instant cap = opened.plus(SIGNALS_AT_MOST);
        Instant to = end.isAfter(cap) ? cap : end;
        return new SignalWindow(c.assetId(), from, to.isBefore(opened) ? opened : to);
    }

    /** A treatment opens only on an open case. The persistent treatment store rechecks under the case lock. */
    public void requireOpen(String tenantCode, long symptomId) {
        if (find(tenantCode, symptomId).closedAt() != null) {
            throw new IllegalStateException("the case is closed");
        }
    }

    /** As {@link #close(String, long, String, boolean)} for a case the operator handled. */
    public void close(String tenantCode, long symptomId, String actor) {
        close(tenantCode, symptomId, actor, false);
    }

    /**
     * An operator closed the case's treatment: the case closes. While the condition holds on the case's trip, the
     * symptom opens no new case on the vehicle after an invalidation, and after a handled close only above the
     * case's level ({@link OperatorClose}). The marker is installed under the case lock before the CLOSED row,
     * so a failed marker write leaves the case open and the call can be retried. The CLOSED row records the close, so a restart keeps the block. Publishes
     * {@code symptom.case.closed}.
     *
     * @param invalidated the operator invalidated the case
     */
    public void close(String tenantCode, long symptomId, String actor, boolean invalidated) {
        EngineCase c = find(tenantCode, symptomId);
        if (c.closedAt() == null) {
            Instant at = clock.instant();
            OperatorClose how = new OperatorClose(c.tripId(), at, c.level(), invalidated);
            var mark = forget.operatorClose(tenantCode, c.assetId(), c.definitionId());
            if (store.close(tenantCode, c.id(), actor, at, how, mark)) {
                events.closedByOperator(tenantCode, c, actor, at);
            }
        }
    }

    /** The reason a CLOSED transition gives when the symptom's state change closed the case. */
    public static final String STATE_CHANGE_REASON = com.microboxlabs.miot.symptoms.evaluator.Transition.STATE_CHANGE_REASON;

    /**
     * Closes the open cases whose state is no longer their symptom's (TEST to ACTIVE, ACTIVE to TEST, or OFF) and
     * drops their episodes, so the next signal opens a fresh case in the new state. Idempotent: a closed case is
     * not closed again. A failed episode drop is left to the evaluator, which closes an episode of the old state
     * itself. Publishes {@code symptom.case.closed} for each.
     *
     * @param tenantCode   null for every organization
     * @param definitionId null for every symptom
     * @return how many cases it closed
     */
    public int closeStaleCases(String tenantCode, UUID definitionId) {
        Instant at = clock.instant();
        List<EngineCaseStore.StaleCase> closed = store.closeStale(tenantCode, definitionId, at, STATE_CHANGE_REASON);
        for (EngineCaseStore.StaleCase c : closed) {
            try {
                forget.staleEpisode(c);
            } catch (RuntimeException e) {
                LOG.warnf("Engine case %d: episode not dropped after the state change (%s)", c.id(),
                        e.getClass().getSimpleName());
            }
            events.closedByStateChange(c.tenantCode(), c, at);
        }
        return closed.size();
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
