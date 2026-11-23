package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MonitorRun;
import com.microboxlabs.miot.trips.domain.MonitorScope;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.dto.FeedBatchRequest;
import com.microboxlabs.miot.trips.dto.FeedBatchResult;
import com.microboxlabs.miot.trips.dto.FeedResult;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.events.TripEvents;
import com.microboxlabs.miot.trips.service.AssignmentService;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.FeedBatchService;
import com.microboxlabs.miot.trips.service.FeedReconciler;
import com.microboxlabs.miot.trips.service.FeedServiceJobHandler;
import com.microboxlabs.miot.trips.service.FeedSites;
import com.microboxlabs.miot.trips.service.LocationService;
import com.microboxlabs.miot.trips.service.MandateService;
import com.microboxlabs.miot.trips.service.MilestoneService;
import com.microboxlabs.miot.trips.service.MonitorClock;
import com.microboxlabs.miot.trips.service.MonitorEngine;
import com.microboxlabs.miot.trips.service.MonitorService;
import com.microboxlabs.miot.trips.service.StageService;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import com.microboxlabs.miot.trips.service.TripService;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * The monitors published in production, run through the real {@link MonitorEngine} and the real feed: each scenario
 * names the monitor, its version and the rules it proves. {@code monitors/published.jsonl} holds the published plan,
 * params and rules as they are, with neutral tenant and monitor names. The last test fails when a rule of a version is
 * neither hit by a scenario nor listed as unreachable. A baseline: these tests pin today's behaviour, quirks included,
 * so the milestone refactor can prove each step changes nothing. Skipped unless {@code -Dmiot.trips.test.pg-url=…}.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PgPublishedMonitorScenariosTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String FEED = "services";
    private static final String ACTOR = "feed:test";
    private static final String LEGACY = "legacy-feed";
    private static final String GENERAL = "feed-general";
    private static final ObjectMapper JSON = JsonMapper.builder().findAndAddModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build();
    private static final List<Version> PUBLISHED = load();
    /** Rules no scenario can hit, with the reason. */
    private static final Map<String, Map<String, String>> UNREACHABLE = Map.of(GENERAL,
            Map.of("presentation-confirmed", "published with active: false, so the engine never evaluates it"));
    /** The rules each version's scenarios hit, filled by {@link #expect}. */
    private static final Map<String, Set<String>> HITS = new ConcurrentHashMap<>();

    private static Vertx vertx;
    private static Pool pool;

    private final MovableClock clock = new MovableClock(Instant.now().truncatedTo(ChronoUnit.SECONDS));
    private final Transactions tx = new PgTransactions(() -> pool);
    private final MonitorEngine[] engineRef = new MonitorEngine[1];
    private final AuditService audit = new AuditService(new PgAuditStore(() -> pool), () -> engineRef[0]);
    private final MandateService mandates = new MandateService(new PgMandateStore(() -> pool), audit, tx);
    private final TripLiveProjector projector = PgTripsStoresTest.projector(() -> pool);
    private final TripService trips = new TripService(new PgTripStore(() -> pool), new PgStageStore(() -> pool),
            new PgAssignmentStore(() -> pool), new PgTripCargoStore(() -> pool), new PgCargoStore(() -> pool),
            mandates, projector, audit, tx);
    private final StageService stages = new StageService(new PgStageStore(() -> pool), new PgTripStore(() -> pool),
            new PgTripCargoStore(() -> pool), mandates, projector, audit, tx);
    private final FleetResourcesService fleet = new FleetResourcesService(
            new com.microboxlabs.miot.fleet.resources.store.PgResourceStore(() -> pool), tx);
    private final AssignmentService assignments = new AssignmentService(new PgAssignmentStore(() -> pool),
            new PgTripStore(() -> pool), fleet, projector, audit, tx);
    private final LocationService locations = new LocationService(new PgLocationStore(() -> pool),
            new FakeGeofences(), new PgTripStore(() -> pool), projector, audit, tx);
    private final List<OperationalEvent> fired = new CopyOnWriteArrayList<>();
    private final TripEvents events = TripEvents.collecting(fired, new PgTripStore(() -> pool),
            new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool), new PgLocationStore(() -> pool),
            new PgMandateStore(() -> pool), fleet);
    private final MilestoneService milestones = new MilestoneService(new PgMilestoneStore(() -> pool),
            new PgTripStore(() -> pool), audit, events, tx, clock);
    private final PgMonitorStore monitorStore = new PgMonitorStore(() -> pool);
    private final PgMonitorRunStore runs = new PgMonitorRunStore(() -> pool);
    private final MonitorService monitors = new MonitorService(monitorStore, null, null, audit, tx);
    private final MonitorEngine engine = new MonitorEngine(runs, monitorStore, new PgTripStore(() -> pool),
            new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool), new PgLocationStore(() -> pool), stages,
            trips, mandates, milestones, fleet, audit, events, tx, clock);
    private final PgFeedStore feeds = new PgFeedStore(() -> pool);
    private final FeedReconciler reconciler = new FeedReconciler(feeds, mandates, trips, stages, assignments,
            locations, milestones, audit, events, fleet, tx, JSON, clock);
    private final MonitorClock timers = new MonitorClock(runs, engine, clock, true, 120, 500);

    private String tenant;

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(
                PgTripsStoresTest.URL_PROPERTY))).using(vertx).build();
        PgTripsStoresTest.recreateSchemas(pool);
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    // ---------------------------------------------------------------- the published monitors

    /** One published version, as in {@code monitors/published.jsonl}. */
    record Version(String tenant, String key, int version, List<TripMonitor.StagePlan> plan,
            Map<String, Object> params, List<MonitorRequest.Rule> rules) {

        String id() {
            return key + " v" + version + " (" + tenant + ")";
        }

        boolean has(String rule) {
            return rules.stream().anyMatch(r -> r.key().equals(rule));
        }

        Set<String> activeTimers() {
            return rules.stream().filter(r -> !Boolean.FALSE.equals(r.active()) && "timer".equals(r.on()))
                    .map(MonitorRequest.Rule::key).collect(Collectors.toCollection(TreeSet::new));
        }

        String arrivalStage() {
            return plan.stream().anyMatch(s -> s.stageType().equals("unloading")) ? "unloading" : "closing";
        }

        @Override
        public String toString() {
            return id();
        }
    }

    private static List<Version> load() {
        List<Version> out = new ArrayList<>();
        try (InputStream in = PgPublishedMonitorScenariosTest.class.getResourceAsStream("/monitors/published.jsonl");
                BufferedReader lines = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            for (String line = lines.readLine(); line != null; line = lines.readLine()) {
                if (line.isBlank()) {
                    continue;
                }
                JsonNode n = JSON.readTree(line);
                out.add(new Version(n.get("tenant").asText(), n.get("monitorKey").asText(), n.get("version").asInt(),
                        JSON.convertValue(n.get("plan"), new TypeReference<List<TripMonitor.StagePlan>>() { }),
                        JSON.convertValue(n.get("params"), new TypeReference<Map<String, Object>>() { }),
                        JSON.convertValue(n.get("rules"), new TypeReference<List<MonitorRequest.Rule>>() { })));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return List.copyOf(out);
    }

    static Stream<Version> legacy() {
        return PUBLISHED.stream().filter(v -> v.key().equals(LEGACY));
    }

    /** Legacy versions with the GPS rules (v2 and later). */
    static Stream<Version> legacyWithGps() {
        return legacy().filter(v -> v.has("gps-left-origin-unauthorized"));
    }

    static Stream<Version> legacyV1() {
        return legacy().filter(v -> !v.has("gps-entered-destination"));
    }

    static Stream<Version> legacyV3() {
        return legacy().filter(v -> v.has("eta-arrival"));
    }

    static Stream<Version> general() {
        return PUBLISHED.stream().filter(v -> v.key().equals(GENERAL));
    }

    // ---------------------------------------------------------------- helpers

    /** A tenant with the feed and the version published, scoped to that feed. */
    private void publish(Version v) {
        engineRef[0] = engine;
        tenant = v.tenant() + "-" + UUID.randomUUID().toString().substring(0, 8);
        feeds.saveProfile(new FeedProfile(tenant, FEED, "Services", null, v.plan().stream()
                .map(s -> new FeedProfile.StagePlan(s.stageType(), s.serviceStatus())).toList(), v.arrivalStage(),
                Set.of(), false, true, null, ACTOR, null, ACTOR));
        monitors.saveDraft(tenant, ACTOR, v.key(), new MonitorRequest(v.key(), null, v.plan(), v.params(), v.rules(),
                new MonitorScope(List.of(FEED), List.of(), List.of(), List.of())));
        monitors.publish(tenant, ACTOR, v.key());
    }

    private OffsetDateTime at(double hours) {
        return OffsetDateTime.ofInstant(clock.instant().plusSeconds((long) (hours * 3600)), ZoneOffset.UTC);
    }

    /** The feed row: planned departure and arrival in hours from the clock, and the actual times it has. */
    private static FeedServiceRequest row(OffsetDateTime plannedStart, OffsetDateTime plannedEnd,
            OffsetDateTime actualStart, OffsetDateTime actualArrival, OffsetDateTime actualEnd) {
        return new FeedServiceRequest("direct", null, null, null, plannedStart, plannedEnd, actualStart,
                actualArrival, actualEnd, new FeedServiceRequest.Resources(null, null, List.of()), null);
    }

    private FeedResult send(String code, FeedServiceRequest row) {
        FeedResult r = reconciler.reconcile(tenant, ACTOR, FEED, code, row, false);
        assertEquals(List.of(), r.errors(), () -> code + " " + r);
        return r;
    }

    private UUID created(Version v, OffsetDateTime plannedStart, OffsetDateTime plannedEnd) {
        FeedResult r = send("S-1", row(plannedStart, plannedEnd, null, null, null));
        assertEquals(FeedReconciler.CREATE, r.action());
        UUID tripId = UUID.fromString(r.tripId());
        assertEquals(v.key(), engine.state(tenant, tripId).orElseThrow().monitorKey(), "the feed's scope binds it");
        return tripId;
    }

    private String status(UUID tripId, String stageType) {
        return trips.detail(tenant, tripId).stages().stream().filter(s -> s.stageType().equals(stageType))
                .map(StageView::status).findFirst().orElseThrow();
    }

    private String milestone(UUID tripId, String name) {
        return milestones.list(tenant, tripId).stream().filter(m -> m.milestone().equals(name))
                .map(TripMilestone::status).findFirst().orElseThrow();
    }

    private List<MonitorRun.Transition> transitions(UUID tripId) {
        return engine.transitions(tenant, tripId, 200);
    }

    private List<String> matched(UUID tripId) {
        return transitions(tripId).stream().flatMap(t -> t.matched().stream()).toList();
    }

    private long count(UUID tripId, String rule) {
        return matched(tripId).stream().filter(rule::equals).count();
    }

    /** The alerts the trip's transitions raised, in order. */
    private List<String> alerts(UUID tripId) {
        List<MonitorRun.Transition> ordered = new ArrayList<>(transitions(tripId));
        java.util.Collections.reverse(ordered);
        return ordered.stream().flatMap(t -> t.actions().stream())
                .filter(a -> "alert".equals(a.get("type"))).map(a -> String.valueOf(a.get("value"))).toList();
    }

    private Set<String> pendingTimers(UUID tripId) {
        return engine.pendingTimers(tenant, tripId).stream().map(MonitorRun.Timer::ruleKey)
                .collect(Collectors.toCollection(TreeSet::new));
    }

    /** Fails naming the version and rule when {@code rules} did not match on the trip; records them as hit. */
    private void expect(Version v, UUID tripId, String... rules) {
        List<String> got = matched(tripId);
        for (String rule : rules) {
            assertTrue(v.has(rule), v + " has no rule " + rule);
            assertTrue(got.contains(rule), () -> v + " · " + rule + " did not match; matched " + got);
            HITS.computeIfAbsent(v.id(), k -> ConcurrentHashMap.newKeySet()).add(rule);
        }
    }

    private void notMatched(Version v, UUID tripId, String rule) {
        assertFalse(matched(tripId).contains(rule), () -> v + " · " + rule + " must not match; matched "
                + matched(tripId));
    }

    private MonitorRun.Transition by(UUID tripId, String rule) {
        return transitions(tripId).stream().filter(t -> rule.equals(t.ruleKey())).findFirst().orElseThrow(
                () -> new AssertionError(rule + " made no transition"));
    }

    /** Moves the clock and fires what is due. */
    private void passTo(OffsetDateTime when) {
        clock.set(when.toInstant());
        timers.tick();
    }

    // ---------------------------------------------------------------- legacy-feed

    @ParameterizedTest(name = "{0} · plan-start, departure-confirmed, closure-confirmed: the feed runs the trip")
    @MethodSource("legacy")
    @Order(1)
    void legacyTheFeedCreatesDepartsAndClosesTheTrip(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        expect(v, tripId, "plan-start");
        assertEquals(Stage.RUNNING, status(tripId, "preparation"));
        assertEquals(Stage.PENDING, status(tripId, "transit"));
        assertEquals(v.activeTimers(), pendingTimers(tripId), "the version's timers are scheduled at creation");
        assertEquals(List.of(), alerts(tripId));

        FeedResult departed = send("S-1", row(at(2), at(10), at(-0.1), null, null));
        assertTrue(departed.operations().stream().anyMatch(o -> o.startsWith("confirm departure at ")),
                departed.operations().toString());
        expect(v, tripId, "departure-confirmed");
        MonitorRun.Transition moved = by(tripId, "departure-confirmed");
        assertEquals("preparation", moved.fromStage());
        assertEquals("transit", moved.toStage());
        assertEquals(Stage.CLOSED, status(tripId, "preparation"));
        assertEquals(Stage.RUNNING, status(tripId, "transit"));
        assertEquals(TripMilestone.CONFIRMED, milestone(tripId, TripMilestone.DEPARTURE));

        FeedResult closed = send("S-1", row(at(2), at(10), at(-0.1), null, at(-0.05)));
        assertTrue(closed.operations().stream().anyMatch(o -> o.startsWith("confirm closure at ")),
                closed.operations().toString());
        expect(v, tripId, "closure-confirmed");
        assertEquals(Trip.DONE, trips.get(tenant, tripId).status());
        assertEquals(Mandate.CLOSED, mandates.get(tenant, UUID.fromString(closed.mandateId())).status());
        assertEquals(TripMilestone.OPEN, milestone(tripId, TripMilestone.ARRIVAL), "nobody asked for the arrival");
        assertEquals(Set.of(), pendingTimers(tripId), "a finished trip keeps no timers");
        assertEquals(List.of(), alerts(tripId));
    }

    @ParameterizedTest(name = "{0} · gps-left-origin-unauthorized: leaving before the departure alerts once,"
            + " after it nothing")
    @MethodSource("legacyWithGps")
    @Order(1)
    void legacyLeavingTheOriginWithoutADepartureAlerts(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        engine.signal(tenant, "gps", tripId, "left_origin", "17", at(0));
        expect(v, tripId, "gps-left-origin-unauthorized");
        assertEquals(List.of("departure_unauthorized"), alerts(tripId));
        assertEquals(Stage.RUNNING, status(tripId, "preparation"), "the alert does not move the trip");

        send("S-1", row(at(2), at(10), at(0.01), null, null));
        engine.signal(tenant, "gps", tripId, "left_origin", "17", at(0.02));
        assertEquals(1, count(tripId, "gps-left-origin-unauthorized"), "a confirmed departure is authorized");
    }

    @ParameterizedTest(name = "{0} · gps-entered-destination: GPS arrival alerts gps_arrival; v3 also asks for"
            + " the arrival, which stays pending until the feed closes the trip")
    @MethodSource("legacyWithGps")
    @Order(1)
    void legacyEnteringTheDestinationAlertsAndV3AsksForTheArrival(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        send("S-1", row(at(2), at(10), at(-0.1), null, null));

        engine.signal(tenant, "gps", tripId, "entered_destination", "42", at(0));
        expect(v, tripId, "gps-entered-destination");
        assertEquals(List.of("gps_arrival"), alerts(tripId));
        assertEquals(Stage.RUNNING, status(tripId, "transit"), "a GPS arrival does not move the trip");
        boolean asks = v.has("eta-arrival");
        assertEquals(asks ? TripMilestone.PENDING : TripMilestone.OPEN, milestone(tripId, TripMilestone.ARRIVAL));

        send("S-1", row(at(2), at(10), at(-0.1), null, at(0.01)));
        assertEquals(Trip.DONE, trips.get(tenant, tripId).status(), "the closure ends the trip without an arrival");
        assertEquals(asks ? TripMilestone.PENDING : TripMilestone.OPEN, milestone(tripId, TripMilestone.ARRIVAL),
                "the arrival request is left as it was");
    }

    @ParameterizedTest(name = "{0} · gps-entered-destination: v1 has no GPS rule, a GPS arrival matches nothing")
    @MethodSource("legacyV1")
    @Order(1)
    void legacyV1IgnoresGpsSignals(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        engine.signal(tenant, "gps", tripId, "left_origin", "17", at(0));
        engine.signal(tenant, "gps", tripId, "entered_destination", "42", at(0.1));
        assertEquals(List.of("plan-start"), matched(tripId));
        assertEquals(TripMilestone.OPEN, milestone(tripId, TripMilestone.ARRIVAL));
    }

    @ParameterizedTest(name = "{0} · eta-arrival, arrival-rejected: planned end + 240 min in transit asks for the"
            + " arrival; a rejection alerts detection_rejected")
    @MethodSource("legacyV3")
    @Order(1)
    void legacyV3AsksForTheArrivalAfterTheEtaAndRecordsARejection(Version v) {
        publish(v);
        OffsetDateTime plannedEnd = at(3);
        UUID tripId = created(v, at(1), plannedEnd);
        send("S-1", row(at(1), plannedEnd, at(-0.1), null, null));
        assertEquals(Set.of("eta-arrival"), pendingTimers(tripId));

        passTo(plannedEnd.plusMinutes(239));
        notMatched(v, tripId, "eta-arrival");
        passTo(plannedEnd.plusMinutes(241));
        expect(v, tripId, "eta-arrival");
        assertEquals(TripMilestone.PENDING, milestone(tripId, TripMilestone.ARRIVAL));
        assertEquals(Stage.RUNNING, status(tripId, "transit"));

        milestones.reject(tenant, "ops@example.com", tripId, TripMilestone.ARRIVAL, "reply", "not there yet");
        expect(v, tripId, "arrival-rejected");
        assertEquals(TripMilestone.REJECTED, milestone(tripId, TripMilestone.ARRIVAL));
        assertEquals(List.of("detection_rejected"), alerts(tripId));
        assertEquals(Stage.RUNNING, status(tripId, "transit"), "a rejection does not move the trip");
    }

    @ParameterizedTest(name = "{0} · eta-arrival: the timer asks nothing while the trip is still in preparation")
    @MethodSource("legacyV3")
    @Order(1)
    void legacyV3EtaTimerNeedsTransit(Version v) {
        publish(v);
        OffsetDateTime plannedEnd = at(3);
        UUID tripId = created(v, at(1), plannedEnd);
        passTo(plannedEnd.plusMinutes(241));
        notMatched(v, tripId, "eta-arrival");
        assertEquals(TripMilestone.OPEN, milestone(tripId, TripMilestone.ARRIVAL));
    }

    @ParameterizedTest(name = "{0} · regularized: a service sent with its departure, arrival and closure in the"
            + " past is recorded done, without the monitor")
    @MethodSource("legacy")
    @Order(1)
    void legacyARegularizedTripRunsNoRule(Version v) {
        publish(v);
        List<AsyncJobSpec> queued = new ArrayList<>();
        FeedBatchService batches = new FeedBatchService(reconciler, (t, f, specs) -> queued.addAll(specs));
        FeedBatchResult sent = batches.send(tenant, ACTOR, FEED, new FeedBatchRequest("b1", List.of(
                new FeedBatchRequest.Item("S-9", row(at(-12), at(-5), at(-11.5), at(-6), at(-5.5))))));
        assertEquals(List.of("S-9"), sent.queued());
        JobOutcome done = new FeedServiceJobHandler(reconciler, new FeedSites(null, null), JSON, feeds)
                .handle(tenant, queued.get(0).payload());
        assertEquals(JobOutcome.SUCCEEDED, done.outcome());
        assertEquals(FeedReconciler.REGULARIZE, done.result().get("action"));

        com.microboxlabs.miot.trips.domain.FeedService service = feeds.service(tenant, FEED, "S-9").orElseThrow();
        assertFalse(service.open(), "a regularized service is closed");
        UUID tripId = UUID.fromString(service.tripId());
        Trip trip = trips.get(tenant, tripId);
        assertEquals(Trip.DONE, trip.status());
        assertTrue(at(-11.5).isEqual(trip.actualStart()));
        assertTrue(at(-5.5).isEqual(trip.actualEnd()));
        assertTrue(engine.state(tenant, tripId).isEmpty(), "no monitor, though its scope takes the feed");
        assertEquals(List.of(), transitions(tripId));
        assertEquals(Set.of(), pendingTimers(tripId));
        for (String m : List.of(TripMilestone.DEPARTURE, TripMilestone.ARRIVAL, TripMilestone.CLOSURE)) {
            assertEquals(TripMilestone.CONFIRMED, milestone(tripId, m), m);
        }
        trips.detail(tenant, tripId).stages().forEach(s -> assertEquals(Stage.CLOSED, s.status(), s.stageType()));
        assertEquals(Mandate.CLOSED, mandates.get(tenant, UUID.fromString(service.mandateId())).status());
    }

    // ---------------------------------------------------------------- feed-general

    @ParameterizedTest(name = "{0} · plan-start, trip-created: created on time → preparation; v2 alerts"
            + " trip_created")
    @MethodSource("general")
    @Order(1)
    void generalCreatedOpensPreparation(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        expect(v, tripId, "plan-start");
        assertEquals(Stage.RUNNING, status(tripId, "preparation"));
        for (String later : List.of("loading", "transit", "unloading", "closing")) {
            assertEquals(Stage.PENDING, status(tripId, later), later);
        }
        if (v.has("trip-created")) {
            expect(v, tripId, "trip-created");
            assertEquals(List.of("trip_created"), alerts(tripId));
        } else {
            assertEquals(List.of(), alerts(tripId));
        }
        notMatched(v, tripId, "plan-departure-overdue");
        assertEquals(Set.of("timer-closure-overdue", "timer-departure-overdue"), pendingTimers(tripId));
    }

    @ParameterizedTest(name = "{0} · plan-departure-overdue: created after its planned departure → departure_overdue")
    @MethodSource("general")
    @Order(1)
    void generalCreatedLateAlertsDepartureOverdue(Version v) {
        publish(v);
        UUID tripId = created(v, at(-1), at(6));
        expect(v, tripId, "plan-start", "plan-departure-overdue");
        assertTrue(alerts(tripId).contains("departure_overdue"), alerts(tripId).toString());
    }

    @ParameterizedTest(name = "{0} · gps-entered-origin: entering the origin asks for the presentation;"
            + " presentation-confirmed is inactive, so confirming it moves nothing")
    @MethodSource("general")
    @Order(1)
    void generalEnteringTheOriginAsksForThePresentation(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        engine.signal(tenant, "gps", tripId, "entered_origin", "17", at(0));
        expect(v, tripId, "gps-entered-origin");
        assertEquals(TripMilestone.PENDING, milestone(tripId, TripMilestone.PRESENTATION));
        assertEquals(Stage.RUNNING, status(tripId, "preparation"));

        milestones.confirm(tenant, "ops@example.com", tripId, TripMilestone.PRESENTATION, null, "ui", null);
        assertEquals(TripMilestone.CONFIRMED, milestone(tripId, TripMilestone.PRESENTATION));
        notMatched(v, tripId, "presentation-confirmed");
        assertEquals(Stage.RUNNING, status(tripId, "preparation"));
        assertEquals(Stage.PENDING, status(tripId, "loading"));
    }

    @ParameterizedTest(name = "{0} · departure-confirmed: the feed's departure → transit; then the departure"
            + " timer finds it confirmed and stays silent")
    @MethodSource("general")
    @Order(1)
    void generalTheFeedsDepartureStartsTransit(Version v) {
        publish(v);
        OffsetDateTime plannedStart = at(1);
        UUID tripId = created(v, plannedStart, at(10));
        send("S-1", row(plannedStart, at(10), at(0.5), null, null));
        expect(v, tripId, "departure-confirmed");
        MonitorRun.Transition moved = by(tripId, "departure-confirmed");
        assertEquals("preparation", moved.fromStage());
        assertEquals("transit", moved.toStage());
        assertEquals(Stage.RUNNING, status(tripId, "transit"));
        assertEquals(Stage.PENDING, status(tripId, "loading"), "loading is skipped, not run");

        passTo(plannedStart.plusMinutes(16));
        notMatched(v, tripId, "timer-departure-overdue");
        assertFalse(alerts(tripId).contains("departure_overdue"));
    }

    @ParameterizedTest(name = "{0} · timer-departure-overdue: no departure at planned departure + 15 min →"
            + " departure_overdue")
    @MethodSource("general")
    @Order(1)
    void generalNoDepartureAfterTheGraceAlerts(Version v) {
        publish(v);
        OffsetDateTime plannedStart = at(1);
        UUID tripId = created(v, plannedStart, at(10));
        passTo(plannedStart.plusMinutes(14));
        notMatched(v, tripId, "timer-departure-overdue");
        passTo(plannedStart.plusMinutes(16));
        expect(v, tripId, "timer-departure-overdue");
        assertTrue(alerts(tripId).contains("departure_overdue"), alerts(tripId).toString());
        assertEquals(Stage.RUNNING, status(tripId, "preparation"));
        assertEquals(Set.of("timer-closure-overdue"), pendingTimers(tripId), "a timer fires once");
    }

    @ParameterizedTest(name = "{0} · gps-left-origin-unauthorized: leaving the origin without a departure →"
            + " departure_unauthorized")
    @MethodSource("general")
    @Order(1)
    void generalLeavingTheOriginWithoutADepartureAlerts(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        engine.signal(tenant, "gps", tripId, "left_origin", "17", at(0));
        expect(v, tripId, "gps-left-origin-unauthorized");
        assertTrue(alerts(tripId).contains("departure_unauthorized"), alerts(tripId).toString());
        assertEquals(Stage.RUNNING, status(tripId, "preparation"));
        assertEquals(TripMilestone.OPEN, milestone(tripId, TripMilestone.DEPARTURE), "no departure is asked");
    }

    @ParameterizedTest(name = "{0} · gps-entered-destination: entering the destination asks for the arrival")
    @MethodSource("general")
    @Order(1)
    void generalEnteringTheDestinationAsksForTheArrival(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        send("S-1", row(at(2), at(10), at(-0.1), null, null));
        engine.signal(tenant, "gps", tripId, "entered_destination", "42", at(0));
        expect(v, tripId, "gps-entered-destination");
        assertEquals(TripMilestone.PENDING, milestone(tripId, TripMilestone.ARRIVAL));
        assertEquals(Stage.RUNNING, status(tripId, "transit"), "only a confirmation moves the trip");
    }

    @ParameterizedTest(name = "{0} · eta-reached, milestone-rejected: an ETA signal asks for the arrival;"
            + " rejecting it alerts detection_rejected")
    @MethodSource("general")
    @Order(1)
    void generalEtaAsksForTheArrivalAndARejectionIsRecorded(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        send("S-1", row(at(2), at(10), at(-0.1), null, null));
        engine.signal(tenant, "eta-model", tripId, "eta_reached", null, at(0), "eta");
        expect(v, tripId, "eta-reached");
        assertEquals(TripMilestone.PENDING, milestone(tripId, TripMilestone.ARRIVAL));

        milestones.reject(tenant, "ops@example.com", tripId, TripMilestone.ARRIVAL, "reply", null);
        expect(v, tripId, "milestone-rejected");
        assertEquals(TripMilestone.REJECTED, milestone(tripId, TripMilestone.ARRIVAL));
        assertTrue(alerts(tripId).contains("detection_rejected"), alerts(tripId).toString());
        assertEquals(Stage.RUNNING, status(tripId, "transit"));
    }

    @ParameterizedTest(name = "{0} · milestone-rejected: a rejected departure detection alerts detection_rejected")
    @MethodSource("general")
    @Order(1)
    void generalARejectedDepartureIsRecorded(Version v) {
        publish(v);
        UUID tripId = created(v, at(2), at(10));
        milestones.detect(tenant, "gps", tripId, TripMilestone.DEPARTURE, "gps", at(0), Map.of());
        assertEquals(TripMilestone.PENDING, milestone(tripId, TripMilestone.DEPARTURE));
        milestones.reject(tenant, "ops@example.com", tripId, TripMilestone.DEPARTURE, "reply", null);
        expect(v, tripId, "milestone-rejected");
        assertEquals(List.of("detection_rejected"), alerts(tripId).stream()
                .filter(a -> !a.equals("trip_created")).toList());
        assertEquals(Stage.RUNNING, status(tripId, "preparation"));
    }

    @ParameterizedTest(name = "{0} · arrival-confirmed: the feed's arrival → unloading; its closure is"
            + " recorded but no rule completes the trip, and the closure timer stays silent")
    @MethodSource("general")
    @Order(1)
    void generalTheFeedsArrivalAndClosure(Version v) {
        publish(v);
        OffsetDateTime plannedEnd = at(6);
        UUID tripId = created(v, at(1), plannedEnd);
        send("S-1", row(at(1), plannedEnd, at(-0.3), at(-0.2), null));
        expect(v, tripId, "departure-confirmed", "arrival-confirmed");
        MonitorRun.Transition arrived = by(tripId, "arrival-confirmed");
        assertEquals("transit", arrived.fromStage());
        assertEquals("unloading", arrived.toStage());
        assertEquals(Stage.CLOSED, status(tripId, "transit"));
        assertEquals(Stage.RUNNING, status(tripId, "unloading"));
        assertEquals(TripMilestone.CONFIRMED, milestone(tripId, TripMilestone.ARRIVAL));

        send("S-1", row(at(1), plannedEnd, at(-0.3), at(-0.2), at(-0.1)));
        assertEquals(TripMilestone.CONFIRMED, milestone(tripId, TripMilestone.CLOSURE));
        assertNotEquals(Trip.DONE, trips.get(tenant, tripId).status(), "feed-general has no closure rule");
        assertEquals(Stage.RUNNING, status(tripId, "unloading"));
        assertEquals(Stage.PENDING, status(tripId, "closing"));

        passTo(plannedEnd.plusMinutes(121));
        notMatched(v, tripId, "timer-closure-overdue");
        assertFalse(alerts(tripId).contains("closure_overdue"));
    }

    @ParameterizedTest(name = "{0} · timer-closure-overdue: no closure at planned end + 120 min → closure_overdue")
    @MethodSource("general")
    @Order(1)
    void generalNoClosureAfterTheGraceAlerts(Version v) {
        publish(v);
        OffsetDateTime plannedEnd = at(6);
        UUID tripId = created(v, at(1), plannedEnd);
        send("S-1", row(at(1), plannedEnd, at(-0.3), null, null));
        passTo(plannedEnd.plusMinutes(119));
        notMatched(v, tripId, "timer-closure-overdue");
        passTo(plannedEnd.plusMinutes(121));
        expect(v, tripId, "timer-closure-overdue");
        assertTrue(alerts(tripId).contains("closure_overdue"), alerts(tripId).toString());
        notMatched(v, tripId, "timer-departure-overdue");
    }

    // ---------------------------------------------------------------- coverage

    @Test
    @Order(Integer.MAX_VALUE)
    void everyPublishedRuleIsHitByAScenarioOrListedAsUnreachable() {
        assertEquals(6, PUBLISHED.size(), "two monitors, six published versions");
        Version a = legacy().filter(v -> v.tenant().equals("tenant-a") && v.version() == 1).findFirst().orElseThrow();
        Version c = legacy().filter(v -> v.tenant().equals("tenant-c")).findFirst().orElseThrow();
        assertEquals(List.of(a.plan(), a.params(), a.rules()), List.of(c.plan(), c.params(), c.rules()),
                "both tenants publish the same legacy-feed v1");
        List<String> missing = new ArrayList<>();
        for (Version v : PUBLISHED) {
            Map<String, String> unreachable = UNREACHABLE.getOrDefault(v.key(), Map.of());
            Set<String> hit = HITS.getOrDefault(v.id(), Set.of());
            for (MonitorRequest.Rule r : v.rules()) {
                if (unreachable.containsKey(r.key())) {
                    assertEquals(Boolean.FALSE, r.active(), v + " · " + r.key() + ": " + unreachable.get(r.key()));
                    assertFalse(hit.contains(r.key()), v + " · " + r.key() + " is listed unreachable but matched");
                } else if (!hit.contains(r.key())) {
                    missing.add(v + " · " + r.key());
                }
            }
        }
        assertEquals(List.of(), missing, "rules no scenario hit (run the whole class)");
    }

    /** A clock the test sets. */
    private static final class MovableClock extends Clock {
        private volatile Instant now;

        MovableClock(Instant start) {
            this.now = start;
        }

        void set(Instant at) {
            now = at;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
