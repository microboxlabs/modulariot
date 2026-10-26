package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.MonitorScope;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.dto.MonitorViews;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.MonitorService;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Monitor drafts, versions and scopes against a real database. Skipped unless the test DB URL is set. */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgMonitorServiceTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "admin@example.com";
    private static final String KEY = "direct-service";

    private static Vertx vertx;
    private static Pool pool;

    private final Transactions tx = new PgTransactions(() -> pool);
    private final MonitorService monitors = new MonitorService(new PgMonitorStore(() -> pool), null, null,
            new AuditService(new PgAuditStore(() -> pool)), tx);

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
    void newTenant() {
        tenant = "t-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static MonitorRequest.Rule rule(String key, String on, String at, String when, String action,
            String value) {
        return new MonitorRequest.Rule(key, null, on, at, when, List.of(new TripMonitor.Action(action, value)), null,
                null);
    }

    private static MonitorRequest directService(String departureWhen) {
        return new MonitorRequest("Direct service", null,
                List.of(new TripMonitor.StagePlan("preparation", "ADDED"),
                        new TripMonitor.StagePlan("transit", "SCHEDULED"),
                        new TripMonitor.StagePlan("closing", "FINISHED")),
                Map.of("lateDepartureMinutes", 30, "closeToleranceMinutes", 120),
                List.of(rule("departure-by-gps", "signal", null, departureWhen, "advance", "transit"),
                        rule("late-departure", "timer", "trip.plannedStart + minutes(params.lateDepartureMinutes)",
                                "stage.type == 'preparation'", "alert", "late_departure"),
                        new MonitorRequest.Rule("administrative-close", null, "timer",
                                "stages.closing.plannedEnd + minutes(params.closeToleranceMinutes)",
                                "trip.status == 'in_progress'", List.of(new TripMonitor.Action("completeTrip", null),
                                        new TripMonitor.Action("closeMandates", null)), 5, null)), MonitorScope.ANY);
    }

    @Test
    void aDraftIsSavedPublishedAndThenEditedAsTheNextVersion() {
        MonitorViews.Monitor draft = monitors.saveDraft(tenant, ACTOR, KEY,
                directService("stage.type == 'preparation' && signal.kind == 'left_origin'"));
        assertEquals(1, draft.version());
        assertEquals(List.of(), draft.findings());
        assertEquals("administrative-close", draft.rules().get(0).key(), "rules come ordered by priority");
        assertTrue(draft.rules().get(1).active());

        MonitorViews.Monitor published = monitors.publish(tenant, ACTOR, KEY);
        assertEquals(TripMonitor.PUBLISHED, published.status());
        assertEquals(ACTOR, published.publishedBy());

        MonitorViews.Monitor next = monitors.saveDraft(tenant, ACTOR, KEY, directService("signal.kind == 'x'"));
        assertEquals(2, next.version());
        assertEquals(2, monitors.saveDraft(tenant, ACTOR, KEY, directService("true")).version(),
                "saving again replaces the draft");

        MonitorViews.Detail detail = monitors.get(tenant, KEY);
        assertEquals(2, detail.draft().version());
        assertEquals(1, detail.published().version());
        assertEquals(List.of(2, 1), detail.versions().stream().map(MonitorViews.Version::version).toList());

        MonitorViews.Summary summary = monitors.list(tenant).get(0);
        assertEquals(1, summary.publishedVersion());
        assertEquals(2, summary.draftVersion());

        monitors.discardDraft(tenant, ACTOR, KEY);
        assertNull(monitors.get(tenant, KEY).draft());
        assertThrows(NoSuchElementException.class, () -> monitors.publish(tenant, ACTOR, KEY));
    }

    @Test
    void aDraftWithBadExpressionsSavesWithFindingsButDoesNotPublish() {
        MonitorViews.Monitor draft = monitors.saveDraft(tenant, ACTOR, KEY,
                directService("stage.colour == 'red'"));
        assertEquals(1, draft.findings().size());
        assertEquals("departure-by-gps", draft.findings().get(0).ruleKey());
        assertEquals("when", draft.findings().get(0).field());
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> monitors.publish(tenant, ACTOR, KEY));
        assertTrue(e.getMessage().startsWith("rule departure-by-gps (when)"), e.getMessage());
    }

    @Test
    void theStructureIsCheckedOnSave() {
        MonitorRequest valid = directService("true");
        MonitorRequest missingTime = new MonitorRequest("x", null, null, null,
                List.of(rule("t", "timer", null, null, "alert", "a")), MonitorScope.ANY);
        MonitorRequest unknownStage = new MonitorRequest("x", null, null, null,
                List.of(rule("s", "signal", null, null, "advance", "boarding")), MonitorScope.ANY);
        MonitorRequest unknownAction = new MonitorRequest("x", null, null, null,
                List.of(rule("s", "signal", null, null, "teleport", null)), MonitorScope.ANY);
        assertThrows(IllegalArgumentException.class, () -> monitors.saveDraft(tenant, ACTOR, "Bad Key", valid));
        assertThrows(IllegalArgumentException.class, () -> monitors.saveDraft(tenant, ACTOR, KEY, missingTime),
                "a timer rule needs at");
        assertThrows(IllegalArgumentException.class, () -> monitors.saveDraft(tenant, ACTOR, KEY, unknownStage),
                "unknown stage type");
        assertThrows(IllegalArgumentException.class, () -> monitors.saveDraft(tenant, ACTOR, KEY, unknownAction),
                "unknown action");
        MonitorViews.Monitor outOfPlan = monitors.saveDraft(tenant, ACTOR, KEY, new MonitorRequest("x", null,
                List.of(new TripMonitor.StagePlan("transit", null)), null,
                List.of(rule("s", "signal", null, null, "advance", "unloading")), MonitorScope.ANY));
        assertEquals("then", outOfPlan.findings().get(0).field());
    }

    @Test
    void aMonitorPublishesOnlyWithAScopeThatDuplicatesNoOther() {
        MonitorRequest d = directService("true");
        MonitorViews.Monitor unscoped = monitors.saveDraft(tenant, ACTOR, KEY, new MonitorRequest(d.name(), null,
                d.plan(), d.params(), d.rules(), null));
        assertEquals("scope", unscoped.findings().get(0).field());
        assertThrows(IllegalArgumentException.class, () -> monitors.publish(tenant, ACTOR, KEY));

        monitors.saveDraft(tenant, ACTOR, KEY, withScope(d, MonitorScope.ANY));
        monitors.publish(tenant, ACTOR, KEY);
        MonitorScope toA = new MonitorScope(List.of(), List.of(), List.of(), List.of(PLACE_A));
        monitors.saveDraft(tenant, ACTOR, "to-a", withScope(d, toA));
        assertEquals(List.of(new MonitorViews.Overlap(KEY, d.name(), MonitorScope.Relation.NARROWER)),
                check("to-a", toA), "the narrower scope takes the trips of both");
        monitors.publish(tenant, ACTOR, "to-a");

        MonitorScope direct = new MonitorScope(List.of(), List.of("direct"), List.of(), List.of());
        monitors.saveDraft(tenant, ACTOR, "direct", withScope(d, direct));
        assertEquals(MonitorScope.Relation.DUPLICATE, check("direct", direct).stream()
                .filter(o -> o.key().equals("to-a")).findFirst().orElseThrow().relation(),
                "a direct trip to A would be in both");
        assertThrows(IllegalArgumentException.class, () -> monitors.publish(tenant, ACTOR, "direct"));

        MonitorScope toB = new MonitorScope(List.of(), List.of("direct"), List.of(), List.of(PLACE_B));
        monitors.saveDraft(tenant, ACTOR, "direct", withScope(d, toB));
        assertEquals(List.of(KEY), check("direct", toB).stream().map(MonitorViews.Overlap::key).toList(),
                "to B it meets only the general monitor");
        monitors.publish(tenant, ACTOR, "direct");
        assertEquals(toB, monitors.list(tenant).stream().filter(s -> s.key().equals("direct")).findFirst()
                .orElseThrow().scope());
    }

    private static final String PLACE_A = "00000000-0000-0000-0000-00000000000a";
    private static final String PLACE_B = "00000000-0000-0000-0000-00000000000b";

    private static MonitorRequest withScope(MonitorRequest r, MonitorScope scope) {
        return new MonitorRequest(r.name(), r.description(), r.plan(), r.params(), r.rules(), scope);
    }

    private List<MonitorViews.Overlap> check(String key, MonitorScope scope) {
        return monitors.checkScope(tenant, key, new MonitorViews.ScopeCheckRequest(scope)).overlaps();
    }

    @Test
    void theSchemaAndTheCheckFollowTheTrigger() {
        assertTrue(monitors.schema("signal", Map.of()).stream().anyMatch(f -> f.path().equals("signal.kind")));
        assertTrue(monitors.schema("timer", Map.of("x", 1)).stream()
                .anyMatch(f -> f.path().equals("params.x") && f.type().equals("number")));
        assertTrue(monitors.check(new MonitorViews.CheckRequest("timer", "trip.plannedStart + hours(2.0)", "time",
                null)).ok());
        MonitorViews.CheckResult bad = monitors.check(new MonitorViews.CheckRequest("plan", "signal.kind == 'x'",
                "condition", null));
        assertEquals(false, bad.ok());
        assertEquals(0, bad.findings().get(0).position());
    }
}
