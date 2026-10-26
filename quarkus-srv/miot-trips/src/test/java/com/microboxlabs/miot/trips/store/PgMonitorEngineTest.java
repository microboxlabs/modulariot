package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MonitorRun;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.events.MilestoneReplies;
import com.microboxlabs.miot.trips.events.TripEventCatalog;
import com.microboxlabs.miot.trips.events.TripEventData;
import com.microboxlabs.miot.trips.events.TripEvents;
import com.microboxlabs.miot.core.event.EventContext;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.dto.MonitorViews;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.trips.dto.BoardView;
import com.microboxlabs.miot.trips.dto.TripSheet;
import com.microboxlabs.miot.trips.service.BoardEvents;
import com.microboxlabs.miot.trips.service.BoardService;
import com.microboxlabs.miot.trips.service.ConfirmerService;
import com.microboxlabs.miot.trips.service.MilestoneService;
import com.microboxlabs.miot.trips.service.TripBoard;
import com.microboxlabs.miot.trips.service.TripsTeamDeletionGuard;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.MandateService;
import com.microboxlabs.miot.trips.service.MonitorClock;
import com.microboxlabs.miot.trips.service.MonitorEngine;
import com.microboxlabs.miot.trips.service.MonitorService;
import com.microboxlabs.miot.trips.service.StageService;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import com.microboxlabs.miot.trips.service.TripService;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Monitors running on real trips: the plan rule that opens a trip, GPS signals that move it, a chained stage rule,
 * a timer fired by the clock once, the selector, a hand command, and a failing action that undoes only itself.
 * Skipped unless {@code -Dmiot.trips.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgMonitorEngineTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "ops@example.com";
    private static final String DIRECT = "direct";
    private static final String CONFIRMED = "confirmed";

    private static Vertx vertx;
    private static Pool pool;

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
    private final PgMonitorStore monitorStore = new PgMonitorStore(() -> pool);
    private final PgMonitorRunStore runs = new PgMonitorRunStore(() -> pool);
    private final MonitorService monitors = new MonitorService(monitorStore, audit, tx);
    private final FleetResourcesService fleet = new FleetResourcesService(
            new com.microboxlabs.miot.fleet.resources.store.PgResourceStore(() -> pool));
    private final List<OperationalEvent> fired = new CopyOnWriteArrayList<>();
    private final TripEvents events = TripEvents.collecting(fired, new PgTripStore(() -> pool),
            new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool), new PgLocationStore(() -> pool),
            new PgMandateStore(() -> pool), fleet);
    private final MilestoneService milestones = new MilestoneService(new PgMilestoneStore(() -> pool),
            new PgTripStore(() -> pool), audit, events, tx, Clock.systemUTC());
    private final MonitorEngine engine = new MonitorEngine(runs, monitorStore, new PgTripStore(() -> pool),
            new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool), new PgLocationStore(() -> pool), stages,
            trips, mandates, milestones, fleet, audit, events, tx, Clock.systemUTC());

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

    @BeforeEach
    void tenantWithAMonitor() {
        engineRef[0] = engine;
        tenant = "t-" + UUID.randomUUID().toString().substring(0, 8);
        publish(DIRECT, List.of(
                rule("open-preparation", "plan", null, "event.kind == 'created'", 10, act("start", "preparation")),
                rule("departure-by-gps", "signal", null,
                        "stage.type == 'preparation' && signal.kind == 'left_origin'", 10, act("advance", "transit")),
                rule("departed", "stage", null, "event.kind == 'started' && event.stageType == 'transit'", 10,
                        act("alert", "departed")),
                rule("late-departure", "timer", "trip.plannedStart + minutes(params.lateDepartureMinutes)",
                        "stage.type == 'preparation'", 10, act("alert", "late_departure")),
                rule("arrival-by-gps", "signal", null,
                        "stage.type == 'transit' && signal.kind == 'entered_destination'", 20,
                        act("completeTrip", null), act("closeMandates", null)),
                rule("hand-close", "command", null, "event.kind == 'close'", 10, act("alert", "closed_by_hand"))));
    }

    private void publish(String key, List<MonitorRequest.Rule> rules) {
        monitors.saveDraft(tenant, ACTOR, key, new MonitorRequest("Direct", null, List.of(),
                Map.of("lateDepartureMinutes", 30), rules));
        monitors.publish(tenant, ACTOR, key);
    }

    private static TripMonitor.Action act(String type, String value) {
        return new TripMonitor.Action(type, value);
    }

    private static MonitorRequest.Rule rule(String key, String on, String at, String when, int priority,
            TripMonitor.Action... then) {
        return new MonitorRequest.Rule(key, null, on, at, when, List.of(then), priority, true);
    }

    private TripView newTrip(String monitor, OffsetDateTime plannedStart) {
        Mandate m = mandates.createOrGet(tenant, ACTOR, new MandateRequest("S-" + UUID.randomUUID()
                .toString().substring(0, 6), "direct", null, null, null, null)).mandate();
        List<StageRequest> plan = List.of("preparation", "transit", "closing").stream()
                .map(t -> new StageRequest(t, null, null, null, null, null)).toList();
        return trips.create(tenant, ACTOR, new TripRequest(null, null, plannedStart, List.of(m.id()), plan,
                monitor));
    }

    private UUID id(TripView t) {
        return UUID.fromString(t.id());
    }

    private String status(UUID tripId, String type) {
        return trips.detail(tenant, tripId).stages().stream().filter(s -> s.stageType().equals(type))
                .map(StageView::status).findFirst().orElseThrow();
    }

    private List<String> matched(UUID tripId) {
        return engine.transitions(tenant, tripId, 50).stream().flatMap(t -> t.matched().stream()).toList();
    }

    @Test
    void aTripRunsFromPlanToCompletionOnSignals() {
        TripView t = newTrip(DIRECT, OffsetDateTime.now(ZoneOffset.UTC).plusHours(2));
        UUID tripId = id(t);
        assertEquals(DIRECT, engine.state(tenant, tripId).orElseThrow().monitorKey());
        assertEquals(Stage.RUNNING, status(tripId, "preparation"), "the plan rule opens preparation");
        assertEquals(1, engine.pendingTimers(tenant, tripId).size(), "late-departure is scheduled");

        List<MonitorRun.Transition> moved = engine.signal(tenant, "gps", tripId, "left_origin", "17", null);
        assertEquals("departure-by-gps", moved.get(0).ruleKey());
        assertEquals("preparation", moved.get(0).fromStage());
        assertEquals("transit", moved.get(0).toStage());
        assertTrue(moved.stream().anyMatch(x -> x.matched().contains("departed") && x.depth() > 0),
                "the stage it started is evaluated as a chained event");
        assertEquals(Stage.RUNNING, status(tripId, "transit"));

        engine.signal(tenant, "gps", tripId, "left_origin", "17", null);
        assertEquals(Stage.RUNNING, status(tripId, "transit"), "a repeated signal matches nothing");

        engine.signal(tenant, "gps", tripId, "entered_destination", "42", null);
        assertEquals(Trip.DONE, trips.get(tenant, tripId).status());
        assertEquals(Mandate.CLOSED, mandates.get(tenant, UUID.fromString(t.mandates().get(0).mandateId()))
                .status());
        assertEquals(List.of(), engine.pendingTimers(tenant, tripId), "a finished trip keeps no timers");
    }

    @Test
    void aTimerFiresOnceWhenDue() {
        UUID tripId = id(newTrip(DIRECT, OffsetDateTime.now(ZoneOffset.UTC).minusHours(1)));
        MonitorClock clock = new MonitorClock(runs, engine, Clock.systemUTC(), true, 120, 500);
        assertTrue(clock.tick() >= 1);
        assertTrue(matched(tripId).contains("late-departure"));
        List<MonitorRun.Transition> late = engine.transitions(tenant, tripId, 50).stream()
                .filter(x -> x.matched().contains("late-departure")).toList();
        assertEquals("late_departure", late.get(0).actions().get(0).get("value"));
        clock.tick();
        engine.signal(tenant, "gps", tripId, "noise", null, null);
        clock.tick();
        assertEquals(1, matched(tripId).stream().filter("late-departure"::equals).count(),
                "rescheduling does not fire the same due time again");
    }

    @Test
    void theSelectorPicksTheMonitorAndATripWithoutOneStaysStill() {
        UUID none = id(newTrip(null, null));
        assertTrue(engine.state(tenant, none).isEmpty());
        assertEquals(Stage.PENDING, status(none, "preparation"));
        assertEquals(List.of(), engine.signal(tenant, "gps", none, "left_origin", null, null));

        monitors.saveSelector(tenant, ACTOR, new MonitorViews.SelectorRequest(List.of(
                new MonitorViews.SelectorRequest.Entry("trip.orderType == 'direct'", DIRECT))));
        UUID picked = id(newTrip(null, null));
        assertEquals(DIRECT, engine.state(tenant, picked).orElseThrow().monitorKey());
        assertEquals(Stage.RUNNING, status(picked, "preparation"));
    }

    @Test
    void aStageClosedByHandIsACommandAndAFailingActionUndoesOnlyItself() {
        publish("broken", List.of(rule("to-unloading", "stage", null, "event.kind == 'closed'", 10,
                act("advance", "unloading"))));
        UUID tripId = id(newTrip(DIRECT, null));
        engine.bind(tenant, ACTOR, tripId, "broken", null);
        Stage preparation = new PgStageStore(() -> pool).listBySubject(tenant, Stage.SUBJECT_TRIP, tripId).stream()
                .filter(s -> s.stageType().equals("preparation")).findFirst().orElseThrow();

        stages.close(tenant, ACTOR, UUID.fromString(preparation.id()));

        assertEquals(Stage.CLOSED, status(tripId, "preparation"), "the hand close stays");
        MonitorRun.Transition failed = engine.transitions(tenant, tripId, 50).stream()
                .filter(x -> "to-unloading".equals(x.ruleKey())).findFirst().orElseThrow();
        assertNotNull(failed.error());
        assertTrue(failed.error().contains("no pending unloading stage"), failed.error());
        assertNull(failed.toStage());
    }

    @Test
    void aCommandRuleSeesTheHandClose() {
        UUID tripId = id(newTrip(DIRECT, null));
        Stage preparation = new PgStageStore(() -> pool).listBySubject(tenant, Stage.SUBJECT_TRIP, tripId).stream()
                .filter(s -> s.stageType().equals("preparation")).findFirst().orElseThrow();
        stages.close(tenant, ACTOR, UUID.fromString(preparation.id()));
        assertTrue(matched(tripId).contains("hand-close"));
    }

    private void publishConfirmed() {
        publish(CONFIRMED, List.of(
                rule("open-preparation", "plan", null, "event.kind == 'created'", 10, act("start", "preparation")),
                rule("departure-detected", "signal", null, "signal.kind == 'left_origin'", 10,
                        act("requestConfirmation", "departure")),
                rule("departure-confirmed", "command", null,
                        "event.kind == 'departure_confirmed' && stage.type == 'preparation'", 10,
                        act("advance", "transit")),
                rule("departure-rejected", "command", null, "event.kind == 'departure_rejected'", 10,
                        act("alert", "false_departure")),
                rule("arrival-confirmed", "command", null,
                        "event.kind == 'arrival_confirmed' && milestones.departure.status == 'confirmed'", 10,
                        act("completeTrip", null))));
    }

    private TripMilestone milestone(UUID tripId, String name) {
        return milestones.list(tenant, tripId).stream().filter(m -> m.milestone().equals(name)).findFirst()
                .orElseThrow();
    }

    @Test
    void aDetectionOnlyAsksAndAConfirmationMovesTheTrip() {
        publishConfirmed();
        UUID tripId = id(newTrip(CONFIRMED, null));
        OffsetDateTime seen = OffsetDateTime.parse("2026-10-25T08:32:00Z");
        assertEquals(TripMilestone.OPEN, milestone(tripId, "departure").status());

        engine.signal(tenant, "gps", tripId, "left_origin", "17", seen);
        assertEquals(Stage.RUNNING, status(tripId, "preparation"), "a GPS detection does not move the trip");
        assertTrue(milestones.pending(tenant, null).stream().anyMatch(p -> p.milestone().tripId()
                .equals(tripId.toString()) && p.serviceCode() != null), "it is listed as waiting for a person");
        TripMilestone pending = milestone(tripId, "departure");
        assertEquals(TripMilestone.PENDING, pending.status());
        assertEquals("gps", pending.source());
        assertTrue(seen.isEqual(pending.proposedAt()));
        assertEquals("17", pending.evidence().get("geofenceId"));

        milestones.reject(tenant, ACTOR, tripId, "departure", "reply", "the truck is still at the gate");
        assertEquals(TripMilestone.REJECTED, milestone(tripId, "departure").status());
        assertTrue(matched(tripId).contains("departure-rejected"));
        assertEquals(Stage.RUNNING, status(tripId, "preparation"));

        engine.signal(tenant, "gps", tripId, "left_origin", "17", seen.plusMinutes(5));
        MilestoneService.Outcome confirmed = milestones.confirm(tenant, "+56900000000", tripId, "departure", null,
                "reply", null);
        assertEquals(MilestoneService.Result.CONFIRMED, confirmed.result());
        assertTrue(seen.plusMinutes(5).isEqual(confirmed.milestone().confirmedAt()),
                "without a time, the confirmation takes the one the detection proposed");
        assertEquals(Stage.CLOSED, status(tripId, "preparation"));
        assertEquals(Stage.RUNNING, status(tripId, "transit"));
        MonitorRun.Transition moved = engine.transitions(tenant, tripId, 50).stream()
                .filter(x -> "departure-confirmed".equals(x.ruleKey())).findFirst().orElseThrow();
        assertEquals(seen.plusMinutes(5).toInstant().toString(),
                OffsetDateTime.parse((String) moved.event().get("at")).toInstant().toString(),
                "the monitor gets the confirmed time");

        assertEquals(MilestoneService.Result.UNCHANGED, milestones.confirm(tenant, ACTOR, tripId, "departure",
                seen.plusMinutes(5), "feed", null).result());
        assertEquals(MilestoneService.Result.CONFLICT, milestones.confirm(tenant, ACTOR, tripId, "departure",
                seen.plusMinutes(9), "feed", null).result());
        assertTrue(seen.plusMinutes(5).isEqual(milestone(tripId, "departure").confirmedAt()),
                "the first confirmation stays");
        assertThrows(IllegalStateException.class,
                () -> milestones.reject(tenant, ACTOR, tripId, "departure", "ui", null));

        engine.signal(tenant, "gps", tripId, "left_origin", "17", seen.plusMinutes(30));
        assertEquals(TripMilestone.CONFIRMED, milestone(tripId, "departure").status(),
                "a confirmed milestone is not asked again");
    }

    @Test
    void aMilestoneCanBeConfirmedWithoutADetection() {
        publishConfirmed();
        UUID tripId = id(newTrip(CONFIRMED, null));
        OffsetDateTime left = OffsetDateTime.parse("2026-10-25T08:40:00-05:00");
        milestones.confirm(tenant, "feed:sheet", tripId, "departure", left, "feed", null);
        assertEquals(Stage.RUNNING, status(tripId, "transit"));
        assertTrue(left.isEqual(milestone(tripId, "departure").confirmedAt()));
        assertEquals("feed", milestone(tripId, "departure").channel());

        milestones.confirm(tenant, "feed:sheet", tripId, "arrival", left.plusHours(6), "feed", null);
        assertEquals(Trip.DONE, trips.get(tenant, tripId).status(), "the rule reads milestones.departure.status");
        assertThrows(IllegalArgumentException.class,
                () -> milestones.confirm(tenant, ACTOR, tripId, "unloading", null, "ui", null));
    }

    private List<OperationalEvent> firedFor(UUID tripId, String type) {
        return fired.stream().filter(e -> e.type().equals(type) && e.context().key().equals(tripId.toString()))
                .toList();
    }

    @Test
    void detectionsConfirmationsAndAlertsArePublishedAsTripEvents() {
        publishConfirmed();
        UUID tripId = id(newTrip(CONFIRMED, null));
        OffsetDateTime seen = OffsetDateTime.parse("2026-10-25T08:32:00Z");

        engine.signal(tenant, "eta-model", tripId, "left_origin", null, seen, "eta");
        OperationalEvent detected = firedFor(tripId, TripEventCatalog.MILESTONE_DETECTED).get(0);
        assertEquals(TripEventCatalog.EVENT_SOURCE, detected.source());
        assertEquals(TripEventCatalog.CONTEXT_KIND, detected.context().kind());
        TripEventData d = (TripEventData) detected.data();
        assertEquals("departure", d.milestone());
        assertEquals("departure-detected", d.rule());
        assertEquals("eta", d.source(), "a signal can name its source");
        assertEquals(seen.toInstant(), d.proposedAt());
        assertNotNull(d.serviceCode(), "the event says which service it is about");

        milestones.reject(tenant, ACTOR, tripId, "departure", "reply", null);
        engine.signal(tenant, "gps", tripId, "left_origin", null, seen.plusMinutes(2));
        milestones.reject(tenant, ACTOR, tripId, "departure", "reply", null);
        assertEquals(2, firedFor(tripId, TripEventCatalog.MILESTONE_REJECTED).size());
        assertEquals(1, firedFor(tripId, TripEventCatalog.ALERT).size(),
                "the false_departure alert is published once per trip");
        assertEquals("false_departure", ((TripEventData) firedFor(tripId, TripEventCatalog.ALERT).get(0).data())
                .alert());

        engine.signal(tenant, "gps", tripId, "left_origin", null, seen.plusMinutes(4));
        milestones.confirm(tenant, ACTOR, tripId, "departure", null, "reply", null);
        milestones.confirm(tenant, ACTOR, tripId, "departure", seen.plusMinutes(9), "feed", null);
        TripEventData confirmed = (TripEventData) firedFor(tripId, TripEventCatalog.MILESTONE_CONFIRMED).get(0)
                .data();
        assertEquals(seen.plusMinutes(4).toInstant(), confirmed.confirmedAt());
        assertEquals("reply", confirmed.channel());
        TripEventData conflict = (TripEventData) firedFor(tripId, TripEventCatalog.MILESTONE_CONFLICT).get(0).data();
        assertEquals(seen.plusMinutes(9).toInstant(), conflict.otherAt());
    }

    @Test
    void aChangeThatRollsBackPublishesNothing() {
        publishConfirmed();
        UUID tripId = id(newTrip(CONFIRMED, null));
        assertThrows(IllegalStateException.class, () -> tx.inTransaction(() -> {
            milestones.confirm(tenant, ACTOR, tripId, "departure", null, "ui", null);
            throw new IllegalStateException("the caller fails after the confirmation");
        }));
        assertEquals(List.of(), firedFor(tripId, TripEventCatalog.MILESTONE_CONFIRMED));
        assertEquals(TripMilestone.OPEN, milestone(tripId, "departure").status());
    }

    private OperationalEvent reply(UUID tripId, String eventType, String milestone, String button, String text,
            OffsetDateTime proposedAt) {
        Map<String, Object> data = new java.util.LinkedHashMap<>();
        data.put("eventType", eventType);
        data.put("eventData", Map.of("tripId", tripId.toString(), "milestone", milestone, "source", "gps",
                "proposedAt", proposedAt.toString()));
        data.put("channel", "whatsapp");
        data.put("address", "+56900000000");
        data.put("text", text);
        data.put("buttonPayload", button);
        return new OperationalEvent(MilestoneReplies.REPLY_RECEIVED, "miot-conversational", tenant,
                java.time.Instant.now(), new EventContext("trip", tripId.toString()), data, false);
    }

    @Test
    void aReplyToTheNoticeConfirmsOrRejectsThePendingMilestone() {
        publishConfirmed();
        MilestoneReplies replies = new MilestoneReplies(milestones, new ObjectMapper());
        UUID tripId = id(newTrip(CONFIRMED, null));
        OffsetDateTime seen = OffsetDateTime.parse("2026-10-25T08:32:00Z");
        String detected = TripEventCatalog.MILESTONE_DETECTED;

        assertEquals(MilestoneReplies.Outcome.NOT_PENDING,
                replies.apply(reply(tripId, detected, "departure", "confirm", null, seen)),
                "nothing was detected yet");

        engine.signal(tenant, "gps", tripId, "left_origin", null, seen);
        assertEquals(MilestoneReplies.Outcome.UNCLEAR,
                replies.apply(reply(tripId, detected, "departure", null, "voy saliendo", seen)));
        assertEquals(MilestoneReplies.Outcome.UNCLEAR,
                replies.apply(reply(tripId, detected, "departure", "other_action", "Sí", seen)),
                "an unknown button payload must not fall back to confirming text");
        assertEquals(MilestoneReplies.Outcome.NOT_A_MILESTONE,
                replies.apply(reply(tripId, TripEventCatalog.ALERT, "departure", "confirm", null, seen)));
        assertEquals(MilestoneReplies.Outcome.REJECTED,
                replies.apply(reply(tripId, detected, "departure", null, "No corresponde", seen)));
        assertEquals(TripMilestone.REJECTED, milestone(tripId, "departure").status());

        engine.signal(tenant, "gps", tripId, "left_origin", null, seen.plusMinutes(3));
        assertEquals(MilestoneService.Result.SKIPPED,
                milestones.respondToDetection(tenant, ACTOR, tripId,
                        new MilestoneService.DetectionRef("departure", seen, "gps"), true, "ui", null).result(),
                "a stale panel action must not confirm the newer detection");
        assertEquals(MilestoneReplies.Outcome.NOT_PENDING,
                replies.apply(reply(tripId, detected, "departure", "confirm", null, seen)),
                "a reply to the rejected detection must not confirm the new detection");
        assertEquals(TripMilestone.PENDING, milestone(tripId, "departure").status());
        assertEquals(MilestoneReplies.Outcome.CONFIRMED,
                replies.apply(reply(tripId, detected, "departure", null, "Sí", seen.plusMinutes(3))));
        TripMilestone departure = milestone(tripId, "departure");
        assertEquals(TripMilestone.CONFIRMED, departure.status());
        assertEquals("reply", departure.channel());
        assertEquals("whatsapp:+56900000000", departure.confirmedBy());
        assertTrue(seen.plusMinutes(3).isEqual(departure.confirmedAt()), "confirmed at the detected time");
        assertEquals(Stage.RUNNING, status(tripId, "transit"));
        assertEquals(MilestoneReplies.Outcome.NOT_PENDING,
                replies.apply(reply(tripId, detected, "departure", "confirm", null, seen.plusMinutes(3))),
                "a late tap changes nothing");
    }

    @Test
    void aRolledBackSavepointDoesNotPublishItsDetectionAfterTheOuterCommit() {
        publishConfirmed();
        UUID tripId = id(newTrip(CONFIRMED, null));
        tx.inTransaction(() -> {
            assertThrows(IllegalStateException.class, () -> PgTx.savepoint(() -> {
                milestones.request(tenant, ACTOR, tripId, "departure", "gps",
                        OffsetDateTime.parse("2026-10-25T08:32:00Z"), Map.of());
                throw new IllegalStateException("discard this detection");
            }));
            return null;
        });
        assertEquals(List.of(), firedFor(tripId, TripEventCatalog.MILESTONE_DETECTED));
        assertEquals(TripMilestone.OPEN, milestone(tripId, "departure").status());
    }

    @Test
    void eventEnrichmentDatabaseFailureDoesNotUndoTheConfirmation() {
        UUID tripId = id(newTrip(null, null));
        List<OperationalEvent> published = new CopyOnWriteArrayList<>();
        PgMandateStore brokenMandates = new PgMandateStore(() -> pool) {
            @Override
            public Optional<Mandate> find(String tenantCode, UUID id) {
                Pg.query(pool, "SELECT 1 / 0", Tuple.tuple());
                return Optional.empty();
            }
        };
        TripEvents failingEvents = TripEvents.collecting(published, new PgTripStore(() -> pool),
                new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool), new PgLocationStore(() -> pool),
                brokenMandates, fleet);
        MilestoneService service = new MilestoneService(new PgMilestoneStore(() -> pool), new PgTripStore(() -> pool),
                audit, failingEvents, tx, Clock.systemUTC());

        assertEquals(MilestoneService.Result.CONFIRMED,
                service.confirm(tenant, ACTOR, tripId, "departure", OffsetDateTime.parse("2026-10-25T08:32:00Z"),
                        "api", null).result());
        assertEquals(TripMilestone.CONFIRMED, milestone(tripId, "departure").status());
        assertEquals(List.of(), published);
    }

    @Test
    void retryingConfirmationWithoutTimeOrWithNanosecondsKeepsTheFirstTime() {
        publishConfirmed();
        UUID tripId = id(newTrip(CONFIRMED, null));
        OffsetDateTime precise = OffsetDateTime.parse("2026-10-25T08:40:00.123456789Z");
        MilestoneService.Outcome first = milestones.confirm(tenant, ACTOR, tripId, "departure", precise,
                "api", null);
        OffsetDateTime stored = precise.truncatedTo(ChronoUnit.MICROS);
        assertTrue(stored.isEqual(first.milestone().confirmedAt()));
        assertEquals(MilestoneService.Result.UNCHANGED,
                milestones.confirm(tenant, ACTOR, tripId, "departure", precise, "api", null).result());
        assertEquals(MilestoneService.Result.UNCHANGED,
                milestones.confirm(tenant, ACTOR, tripId, "departure", null, "api", null).result());
        assertTrue(stored.isEqual(milestone(tripId, "departure").confirmedAt()));
        MonitorRun.Transition moved = engine.transitions(tenant, tripId, 50).stream()
                .filter(x -> "departure-confirmed".equals(x.ruleKey())).findFirst().orElseThrow();
        assertEquals(stored.toInstant().toString(),
                OffsetDateTime.parse((String) moved.event().get("at")).toInstant().toString());
    }

    @Test
    void cancellationImmediatelyRemovesPendingTimers() {
        UUID tripId = id(newTrip(DIRECT, OffsetDateTime.now(ZoneOffset.UTC).plusHours(1)));
        assertEquals(1, engine.pendingTimers(tenant, tripId).size());
        trips.cancel(tenant, ACTOR, tripId, "test cancellation");
        assertTrue(engine.pendingTimers(tenant, tripId).isEmpty());
    }

    @Test
    void terminalStageStillEmitsCommandAndStageEvents() {
        publish("terminal", List.of(
                rule("closed-command", "command", null, "event.kind == 'close'", 10, act("alert", "command")),
                rule("closed-stage", "stage", null, "event.kind == 'closed'", 10, act("alert", "stage")),
                rule("late-signal", "signal", null, null, 10, act("alert", "unexpected"))));
        TripView created = trips.create(tenant, ACTOR, new TripRequest(null, null, null, List.of(),
                List.of(new StageRequest("closing", null, null, null, null, null)), "terminal"));
        UUID tripId = id(created);
        UUID stageId = UUID.fromString(stages.listByTrip(tenant, tripId).get(0).id());
        stages.start(tenant, ACTOR, stageId);
        stages.close(tenant, ACTOR, stageId);
        assertEquals(Trip.DONE, trips.get(tenant, tripId).status());
        assertTrue(matched(tripId).containsAll(List.of("closed-command", "closed-stage")));
        assertTrue(engine.signal(tenant, ACTOR, tripId, "late", null, null).isEmpty());
    }

    @Test
    void emptyTripGetsMonitorPlanForExplicitAndSelectorBindings() {
        monitors.saveDraft(tenant, ACTOR, "default-plan", new MonitorRequest("Default plan", null,
                List.of(new TripMonitor.StagePlan("preparation", "ready")), Map.of(),
                List.of(rule("start", "plan", null, "event.kind == 'created'", 10,
                        act("start", "preparation")))));
        monitors.publish(tenant, ACTOR, "default-plan");
        UUID explicit = id(trips.create(tenant, ACTOR,
                new TripRequest(null, null, null, List.of(), List.of(), "default-plan")));
        assertEquals(Stage.RUNNING, status(explicit, "preparation"));
        monitors.saveSelector(tenant, ACTOR, new MonitorViews.SelectorRequest(List.of(
                new MonitorViews.SelectorRequest.Entry("true", "default-plan"))));
        UUID selected = id(trips.create(tenant, ACTOR,
                new TripRequest(null, null, null, List.of(), List.of(), null)));
        assertEquals(Stage.RUNNING, status(selected, "preparation"));
        UUID supplied = id(trips.create(tenant, ACTOR,
                new TripRequest(null, null, null, List.of(),
                        List.of(new StageRequest("transit", null, null, null, null, null)), "default-plan")));
        assertEquals(List.of("transit"), stages.listByTrip(tenant, supplied).stream().map(Stage::stageType).toList());
    }

    @Test
    void allClaimedTimersOnOneTripFireInTheSameTick() {
        publish("two-timers", List.of(
                rule("first", "timer", "trip.plannedStart", null, 10, act("alert", "first")),
                rule("second", "timer", "trip.plannedStart", null, 20, act("alert", "second"))));
        UUID tripId = id(newTrip("two-timers", OffsetDateTime.now(ZoneOffset.UTC).minusHours(1)));
        List<Long> before = engine.pendingTimers(tenant, tripId).stream().map(MonitorRun.Timer::id).sorted().toList();
        engine.signal(tenant, ACTOR, tripId, "unrelated", null, null);
        assertEquals(before,
                engine.pendingTimers(tenant, tripId).stream().map(MonitorRun.Timer::id).sorted().toList());
        MonitorClock clock = new MonitorClock(runs, engine, Clock.systemUTC(), true, 120, 500);
        clock.tick();
        assertTrue(matched(tripId).containsAll(List.of("first", "second")));
        assertTrue(engine.pendingTimers(tenant, tripId).isEmpty());
    }

    @Test
    void timerHistoryIsScopedToMonitorAndVersion() {
        List<MonitorRequest.Rule> rules = List.of(
                rule("deadline", "timer", "trip.plannedStart", null, 10, act("alert", "deadline")));
        publish("timer-a", rules);
        publish("timer-b", rules);
        UUID tripId = id(newTrip("timer-a", OffsetDateTime.now(ZoneOffset.UTC).minusHours(1)));
        MonitorClock clock = new MonitorClock(runs, engine, Clock.systemUTC(), true, 120, 500);
        clock.tick();
        assertEquals(1, matched(tripId).stream().filter("deadline"::equals).count());
        engine.bind(tenant, ACTOR, tripId, "timer-b", null);
        assertEquals(1, engine.pendingTimers(tenant, tripId).size());
        clock.tick();
        assertEquals(2, matched(tripId).stream().filter("deadline"::equals).count());
        engine.bind(tenant, ACTOR, tripId, "timer-a", null);
        assertTrue(engine.pendingTimers(tenant, tripId).isEmpty(), "same monitor version does not fire twice");
        publish("timer-a", rules);
        engine.bind(tenant, ACTOR, tripId, "timer-a", null);
        assertEquals(1, engine.pendingTimers(tenant, tripId).size());
        clock.tick();
        assertEquals(3, matched(tripId).stream().filter("deadline"::equals).count());
    }

    private List<String> cards(BoardService board, String view, String lane, String q) {
        return board.view(tenant, view, q, null, null, null).lanes().stream()
                .filter(l -> l.key().equals(lane)).flatMap(l -> l.cards().stream())
                .map(BoardView.Card::tripId).toList();
    }

    @Test
    void theBoardPlacesATripByItsStageMilestonesAndAlerts() {
        publish("overdue", List.of(
                rule("open", "plan", null, "event.kind == 'created'", 10, act("start", "preparation")),
                rule("late", "timer", "trip.plannedStart", "stage.type == 'preparation'", 10,
                        act("alert", "departure_overdue")),
                rule("left", "signal", null, "stage.type == 'preparation' && signal.kind == 'left_origin'", 10,
                        act("advance", "transit")),
                rule("arrived", "signal", null, "stage.type == 'transit' && signal.kind == 'entered_destination'",
                        10, act("completeTrip", null))));
        BoardService board = new BoardService(new PgBoardStore(() -> pool), fleet, new PgStageStore(() -> pool),
                milestones, runs, new PgConfirmerStore(() -> pool));
        TripView t = newTrip("overdue", OffsetDateTime.now(ZoneOffset.UTC).minusHours(1));
        String trip = t.id();
        String code = t.mandates().get(0).externalCode();

        assertEquals(List.of(trip), cards(board, TripBoard.PLANNING, TripBoard.UNASSIGNED, null));
        new MonitorClock(runs, engine, Clock.systemUTC(), true, 120, 500).tick();
        assertEquals(List.of(trip), cards(board, TripBoard.PLANNING, TripBoard.DEPARTURE_PENDING, null),
                "the monitor's overdue alert");

        engine.signal(tenant, "gps", id(t), "left_origin", "17", null);
        assertEquals(List.of(), cards(board, TripBoard.PLANNING, TripBoard.DEPARTURE_PENDING, null));
        assertEquals(List.of(trip), cards(board, TripBoard.DISPATCH, TripBoard.IN_TRANSIT, code));
        assertEquals(List.of(), cards(board, TripBoard.DISPATCH, TripBoard.IN_TRANSIT, "no-such-code"));

        engine.signal(tenant, "gps", id(t), "entered_destination", "42", null);
        assertEquals(List.of(), cards(board, TripBoard.DISPATCH, TripBoard.IN_TRANSIT, null));
        assertEquals(List.of(trip), cards(board, TripBoard.FINISHED, TripBoard.COMPLETED, code));
        BoardView.Card done = board.view(tenant, TripBoard.FINISHED, null, null, null, null).lanes().get(0)
                .cards().get(0);
        assertEquals(List.of(code), done.codes());
        assertTrue(done.alerts().contains("departure_overdue"));
        assertNotNull(done.departedAt(), "the transit stage's start");

        TripSheet sheet = board.sheet(tenant, id(t));
        assertEquals(TripBoard.COMPLETED, sheet.card().lane());
        assertEquals(List.of("preparation", "transit", "closing"),
                sheet.stages().stream().map(StageView::stageType).toList());
        assertTrue(sheet.transitions().stream().anyMatch(x -> "left".equals(x.ruleKey())));
        assertNull(sheet.feed(), "a trip made by hand has no feed row");
        assertThrows(java.util.NoSuchElementException.class, () -> board.sheet(tenant, UUID.randomUUID()));
    }

    private static void until(java.util.function.BooleanSupplier done, Runnable each, Semaphore notices)
            throws InterruptedException {
        notices.drainPermits();
        for (int i = 0; i < 100 && !done.getAsBoolean(); i++) {
            each.run();
            notices.tryAcquire(100, TimeUnit.MILLISECONDS);
        }
        assertTrue(done.getAsBoolean(), "timed out");
    }

    @Test
    void aCommittedChangeReachesItsTenantsStreamAndARolledBackOneDoesNot() throws InterruptedException {
        BoardEvents boardEvents = new BoardEvents(() -> pool, vertx, true);
        boardEvents.start();
        List<String> got = new CopyOnWriteArrayList<>();
        Semaphore notices = new Semaphore(0);
        var subscription = boardEvents.stream(tenant).filter(c -> "trip".equals(c.type()))
                .subscribe().with(c -> {
                    got.add(c.tripId());
                    notices.release();
                });
        try {
            until(() -> got.contains("probe"), () -> BoardChannel.touched(pool, tenant, "probe"), notices);

            String trip = newTrip(null, null).id();
            until(() -> got.contains(trip), () -> { }, notices);

            assertThrows(IllegalStateException.class, () -> tx.inTransaction(() -> {
                BoardChannel.touched(pool, tenant, "rolled-back");
                throw new IllegalStateException("rollback");
            }));
            BoardChannel.touched(pool, "other-tenant", "elsewhere");
            BoardChannel.touched(pool, tenant, "after");
            until(() -> got.contains("after"), () -> { }, notices);
            assertFalse(got.contains("rolled-back"), "a rolled-back change sends no notice");
            assertFalse(got.contains("elsewhere"), "another tenant's change stays there");
        } finally {
            subscription.cancel();
            boardEvents.stop();
        }
    }

    @Test
    void onlyTheMilestonesTeamConfirmsItAndOnlyPeopleAreChecked() {
        ConfirmerService confirmers = new ConfirmerService(new PgConfirmerStore(() -> pool), monitors, audit, tx);
        UUID ops = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        Pg.query(pool, "INSERT INTO miot_iam.iam_team (id) VALUES ($1), ($2)", Tuple.of(ops, other));
        Set<UUID> orgTeams = Set.of(ops);
        Set<UUID> otherTeam = Set.of(other);
        Map<String, UUID> foreignAssignment = Map.of("departure", other);
        Map<String, UUID> unknownMilestone = Map.of("unloading", ops);
        Map<String, UUID> departureAssignment = Map.of("departure", ops);
        assertThrows(IllegalArgumentException.class, () -> confirmers.save(tenant, ACTOR, DIRECT,
                foreignAssignment, orgTeams), "a team of another organization");
        assertThrows(IllegalArgumentException.class, () -> confirmers.save(tenant, ACTOR, DIRECT,
                unknownMilestone, orgTeams));
        assertThrows(java.util.NoSuchElementException.class, () -> confirmers.save(tenant, ACTOR, "no-such",
                departureAssignment, orgTeams));
        confirmers.save(tenant, ACTOR, DIRECT, departureAssignment, Set.of(ops, other));
        assertEquals(departureAssignment, confirmers.ofMonitor(tenant, DIRECT));

        TripsTeamDeletionGuard deletionGuard = new TripsTeamDeletionGuard(() -> pool);
        var deletionCheck = deletionGuard.requireUnused(ops).await();
        assertThrows(IllegalStateException.class, deletionCheck::indefinitely);

        UUID trip = id(newTrip(DIRECT, null));
        assertThrows(SecurityException.class, () -> confirmers.require(tenant, trip, "departure", otherTeam));
        confirmers.require(tenant, trip, "departure", Set.of(ops, other));
        confirmers.require(tenant, trip, "departure", null);
        confirmers.require(tenant, trip, "arrival", Set.of());
        confirmers.require(tenant, id(newTrip(null, null)), "departure", Set.of());

        confirmers.save(tenant, ACTOR, DIRECT, Map.of(), orgTeams);
        deletionGuard.requireUnused(ops).await().indefinitely();
        confirmers.require(tenant, trip, "departure", Set.of(other));
        assertEquals(Map.of(), confirmers.ofTrip(tenant, trip));
    }

    @Test
    void finishedBoardCountsEveryTripButReturnsOneCardPerLane() {
        TripView cancelled = newTrip(null, null);
        trips.cancel(tenant, ACTOR, id(cancelled), "test cancellation");
        for (int i = 0; i < 4; i++) {
            TripView trip = newTrip(DIRECT, OffsetDateTime.now(ZoneOffset.UTC).minusHours(1));
            engine.signal(tenant, "gps", id(trip), "left_origin", "17", null);
            engine.signal(tenant, "gps", id(trip), "entered_destination", "42", null);
        }

        BoardService board = new BoardService(new PgBoardStore(() -> pool), fleet, new PgStageStore(() -> pool),
                milestones, runs, new PgConfirmerStore(() -> pool));
        BoardView view = board.view(tenant, TripBoard.FINISHED, null, null, null, 1);
        BoardView.Lane completed = view.lanes().stream()
                .filter(lane -> TripBoard.COMPLETED.equals(lane.key())).findFirst().orElseThrow();
        BoardView.Lane cancelledLane = view.lanes().stream()
                .filter(lane -> TripBoard.CANCELLED.equals(lane.key())).findFirst().orElseThrow();
        assertEquals(4, completed.count());
        assertEquals(1, completed.cards().size());
        assertEquals(1, cancelledLane.count());
        assertEquals(List.of(cancelled.id()), cancelledLane.cards().stream().map(BoardView.Card::tripId).toList());
    }

    @Test
    void cancelledBoardKeepsTheRunningLabelAndSearchesItsFinalResources() {
        TripView trip = newTrip(DIRECT, null);
        UUID tripId = id(trip);
        engine.signal(tenant, "gps", tripId, "left_origin", null, null);
        Pg.query(pool, """
                UPDATE miot_trips.stage SET service_status = 'En route'
                WHERE tenant_code = $1 AND subject_type = 'trip' AND subject_id = $2
                  AND stage_type = 'transit' AND version_of IS NULL
                """, Tuple.of(tenant, tripId));

        UUID carrierId = UUID.randomUUID();
        UUID truckId = UUID.randomUUID();
        UUID trailerId = UUID.randomUUID();
        UUID oldDriverId = UUID.randomUUID();
        UUID driverId = UUID.randomUUID();
        UUID secondDriverId = UUID.randomUUID();
        Pg.query(pool, "INSERT INTO miot_fleet.carrier (id, tenant_code, legal_name) VALUES ($1, $2, $3)",
                Tuple.of(carrierId, tenant, "Sample Carrier"));
        Pg.query(pool, """
                INSERT INTO miot_fleet.truck (id, tenant_code, carrier_id, license_plate)
                VALUES ($1, $2, $3, $4)
                """, Tuple.of(truckId, tenant, carrierId, "ZZ-321"));
        Pg.query(pool, """
                INSERT INTO miot_fleet.trailer (id, tenant_code, carrier_id, license_plate)
                VALUES ($1, $2, $3, $4)
                """, Tuple.of(trailerId, tenant, carrierId, "TR-987"));
        Pg.query(pool, """
                INSERT INTO miot_fleet.driver (id, tenant_code, rut, full_name)
                VALUES ($1, $2, $3, $4), ($5, $2, $6, $7), ($8, $2, $9, $10)
                """, Tuple.tuple().addUUID(oldDriverId).addString(tenant).addString("TEST-OLD")
                        .addString("First Driver").addUUID(driverId).addString("TEST-NEW")
                        .addString("Final Driver").addUUID(secondDriverId).addString("TEST-SECOND")
                        .addString("Second Driver"));
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Pg.query(pool, """
                INSERT INTO miot_trips.trip_resource_assignment
                    (tenant_code, trip_id, resource_type, resource_id, valid_from, valid_to)
                VALUES ($1, $2, 'driver', $3, $4, $5), ($1, $2, 'driver', $6, $7, NULL),
                       ($1, $2, 'driver', $8, $9, NULL),
                       ($1, $2, 'truck', $10, $7, NULL), ($1, $2, 'trailer', $11, $7, NULL)
                """, Tuple.tuple().addString(tenant).addUUID(tripId).addUUID(oldDriverId)
                        .addOffsetDateTime(now.minusHours(2)).addOffsetDateTime(now.minusHours(1))
                        .addUUID(driverId).addOffsetDateTime(now.minusMinutes(50)).addUUID(secondDriverId)
                        .addOffsetDateTime(now.minusMinutes(30)).addUUID(truckId).addUUID(trailerId));
        trips.cancel(tenant, ACTOR, tripId, "test cancellation");

        BoardService board = new BoardService(new PgBoardStore(() -> pool), fleet, new PgStageStore(() -> pool),
                milestones, runs, new PgConfirmerStore(() -> pool));
        for (String q : List.of("ZZ-321", "TR-987", "Final Driver", "Second Driver", "Sample Carrier")) {
            assertEquals(List.of(trip.id()), cards(board, TripBoard.FINISHED, TripBoard.CANCELLED, q), q);
        }
        assertEquals(List.of(), cards(board, TripBoard.FINISHED, TripBoard.CANCELLED, "First Driver"));
        BoardView.Card card = board.sheet(tenant, tripId).card();
        assertEquals("En route", card.label());
        assertEquals("Final Driver", card.driver());
        assertEquals("Second Driver", card.secondDriver());
        assertEquals("ZZ-321", card.truck());
        assertEquals("TR-987", card.trailer());
        assertEquals("Sample Carrier", card.carrier());
    }

}
