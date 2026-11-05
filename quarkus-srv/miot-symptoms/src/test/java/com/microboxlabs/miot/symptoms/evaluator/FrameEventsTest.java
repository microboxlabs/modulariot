package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Rules that read the frame's events ({@code signal.frame.events}): opening, closing and noting a case. */
class FrameEventsTest {

    private static final String TENANT = "tenant-a";
    private static final String ACTIVATION = "signal.trip.active && signal.frame.events.exists(e, e.event_type in "
            + "[\"main_power_disconnect\", \"gps_jamming\", \"device_tamper\"])";
    private static final String RECONNECT = "signal.frame.events.exists(e, e.event_type == \"main_power_reconnect\")";

    private final InMemoryTransitionLog log = new InMemoryTransitionLog();
    private final List<Object> published = new ArrayList<>();
    private SymptomCatalogService catalog;
    private EvaluatorStream stream;
    private InMemoryEpisodeRepository episodes;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        SymptomEvents events = new SymptomEvents(e -> {
            published.add(e);
            return CompletableFuture.completedFuture(null);
        }, store::findDefinition, Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        episodes = new InMemoryEpisodeRepository();
        stream = new EvaluatorStream(true, new EvaluatorCatalog(catalog, sources),
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(),
                episodes, SignalSamples.inMemory());
    }

    private UUID publish(String close, String note) {
        return publish("case.condition_s >= 0", close, note);
    }

    private UUID publish(String open, String close, String note) {
        SymptomSpec sabotage = SeedTemplates.get("gps-sabotage").spec();
        SymptomSpec spec = new SymptomSpec("gps_signal", ACTIVATION, null, sabotage.levels(),
                new SymptomSpec.Lifecycle(open, close, false, note), null);
        UUID id = catalog.create(TENANT, "owner@example.com", new CreateRequest("events", "Eventos", null, null,
                null, "gps_signal", null, spec)).definition().id();
        catalog.publish(TENANT, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);
        return id;
    }

    /** A frame on a trip with one event of {@code type}, or none when it is null. */
    private static String signal(String at, String type) {
        return signal(at, type, "T-1");
    }

    private static String signal(String at, String type, String trip) {
        String events = type == null ? "" : """
                ,"events":[{"event_type":"%s","timestamp":"%s","severity":"high","description":"Evento %s",
                 "additional_info":{"source":"test"}}]""".formatted(type, at, type);
        return """
                {"schema":"miot.gps.signal@1","asset_id":"V1","at":"%s","clients":["%s"],
                 "trips":{"%s":{"active":true,"double_driver":false,"id":"%s"}},
                 "local_hour":9,"derived":{"moving":true},
                 "frame":{"asset_id":"V1","gps":{"speed":80.0},"sensors":{}%s}}
                """.formatted(at, TENANT, TENANT, trip, events);
    }

    private List<Transition.Kind> kinds() {
        return log.recorded.stream().map(Transition::kind).toList();
    }

    @Test
    void aDisconnectOpensTheCaseAndAFrameWithoutEventsKeepsItOpen() {
        publish("case.closed_by_operator || " + RECONNECT, null);

        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));
        stream.evaluate(signal("2026-01-01T12:01:00Z", null));

        assertEquals(List.of(Transition.Kind.OPENED), kinds());
    }

    @Test
    void aReconnectDoesNotOpenACaseWhenTheActivationDoesNotListIt() {
        publish("case.closed_by_operator || " + RECONNECT, null);

        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_reconnect"));
        stream.evaluate(signal("2026-01-01T12:01:00Z", "ignition_on"));

        assertTrue(log.recorded.isEmpty());
    }

    @Test
    void theCloseRuleReadsTheSignal() {
        publish("case.closed_by_operator || " + RECONNECT, null);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "device_tamper"));

        stream.evaluate(signal("2026-01-01T12:05:00Z", "main_power_reconnect"));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.CLOSED), kinds());
    }

    @Test
    void anOperatorCloseStillEndsTheCaseAndTheNextEventOpensANewOne() {
        UUID id = publish("case.closed_by_operator || " + RECONNECT, null);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "gps_jamming"));

        stream.forget(TENANT, "V1", id);
        stream.evaluate(signal("2026-01-01T12:05:00Z", "gps_jamming"));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.OPENED), kinds());
    }

    @Test
    void afterAnOperatorCloseTheOpenRuleKnowsTheTripAndANewTripClearsIt() {
        UUID id = publish("case.condition_s >= 0 && !case.closed_on_trip", "case.closed_by_operator", null);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "gps_jamming"));

        stream.forget(TENANT, "V1", id, "T-1");
        stream.evaluate(signal("2026-01-01T12:05:00Z", "gps_jamming"));
        stream.evaluate(signal("2026-01-01T12:06:00Z", null));
        stream.evaluate(signal("2026-01-01T12:07:00Z", "gps_jamming"));
        assertEquals(List.of(Transition.Kind.OPENED), kinds(), "nothing more opens on the same trip");

        stream.evaluate(signal("2026-01-02T08:00:00Z", "gps_jamming", "T-2"));
        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.OPENED), kinds(), "the next trip opens again");
    }

    @Test
    void anOperatorCloseWithoutATripLeavesTheOpenRuleFree() {
        UUID id = publish("case.condition_s >= 0 && !case.closed_on_trip", "case.closed_by_operator", null);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "gps_jamming"));

        stream.forget(TENANT, "V1", id, null);
        stream.evaluate(signal("2026-01-01T12:05:00Z", "gps_jamming"));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.OPENED), kinds());
    }

    @Test
    void aBufferedOlderTripCannotClearTheCurrentTripsCloseMarker() {
        UUID id = publish("case.condition_s >= 0 && !case.closed_on_trip", "case.closed_by_operator", null);
        stream.evaluate(signal("2026-01-02T12:00:00Z", "gps_jamming", "T-2"));
        stream.forget(TENANT, "V1", id, "T-2");
        Episode marker = episodes.load(TENANT, "V1").find(TENANT, "V1", id).orElseThrow();

        stream.evaluate(signal("2026-01-01T12:00:00Z", "gps_jamming", "T-1"));
        assertEquals(marker, episodes.load(TENANT, "V1").find(TENANT, "V1", id).orElseThrow());
        stream.evaluate(signal("2026-01-02T12:01:00Z", "gps_jamming", "T-2"));
        assertEquals(List.of(Transition.Kind.OPENED), kinds());
        stream.evaluate(signal("2026-01-03T12:00:00Z", "gps_jamming", "T-3"));
        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.OPENED), kinds());
    }

    @Test
    void theNoteRuleWritesATimelineEntryWithTheEventAndTheCaseStaysOpen() {
        publish("case.closed_by_operator", RECONNECT);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));

        stream.evaluate(signal("2026-01-01T12:05:00Z", "main_power_reconnect"));
        stream.evaluate(signal("2026-01-01T12:06:00Z", "main_power_disconnect"));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.NOTED), kinds(),
                "the reconnect is noted; the next disconnect opens nothing new");
        @SuppressWarnings("unchecked")
        Map<String, Object> note = (Map<String, Object>) log.contexts.get(1).get("note");
        assertEquals("main_power_reconnect", note.get("event_type"));
        assertEquals("Evento main_power_reconnect", note.get("description"));
        assertEquals("2026-01-01T12:05:00Z", note.get("at"));
        assertEquals(1, published.size(), "a note publishes no case event");
    }

    @Test
    void aNoteRuleThatHoldsForNoSingleEventStillWritesTheFrameTime() {
        publish("case.closed_by_operator", "signal.derived.moving");
        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));

        stream.evaluate(signal("2026-01-01T12:05:00Z", null));

        @SuppressWarnings("unchecked")
        Map<String, Object> note = (Map<String, Object>) log.contexts.get(log.contexts.size() - 1).get("note");
        assertNull(note.get("event_type"));
        assertEquals("2026-01-01T12:05:00Z", note.get("at"));
    }

    @Test
    void aBufferedDisconnectAfterANewerFixOpensTheCase() {
        publish("case.closed_by_operator || " + RECONNECT, null);
        stream.evaluate(signal("2026-01-01T12:10:00Z", null));

        stream.evaluate(signal("2026-01-01T12:05:00Z", "main_power_disconnect"));

        assertEquals(List.of(Transition.Kind.OPENED), kinds());
    }

    @Test
    void bufferedFatigueRepeatsRaiseTheLevelWithoutRewindingSignalState() {
        var spec = SeedTemplates.get("driver-fatigue-sensor").spec();
        UUID id = catalog.create(TENANT, "owner@example.com", new CreateRequest("fatigue", "Fatiga", null, null,
                null, "gps_signal", null, spec)).definition().id();
        catalog.publish(TENANT, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "FYSS"));
        stream.evaluate(signal("2026-01-01T12:16:40Z", null));
        Episode before = episodes.load(TENANT, "V1").find(TENANT, "V1", id).orElseThrow();

        stream.evaluate(signal("2026-01-01T12:15:00Z", "FYSS"));
        stream.evaluate(signal("2026-01-01T12:05:00Z", "FYSS"));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.LEVEL_CHANGED), kinds());
        Episode after = episodes.load(TENANT, "V1").find(TENANT, "V1", id).orElseThrow();
        assertEquals(3, after.level());
        assertEquals(before.lastSignalAt(), after.lastSignalAt());
        assertEquals(before.normalSince(), after.normalSince());
        assertEquals(before.levelSince(), after.levelSince());
        assertEquals(before.lastSignalAt(), episodes.load(TENANT, "V1").watermark(TENANT, "V1", "gps_signal").orElseThrow());
    }

    @Test
    void lateLifecycleRulesReadTheRetainedOffTripTimer() {
        publish("case.off_trip_s >= 1200 && " + RECONNECT, null);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "device_tamper"));
        stream.evaluate(signal("2026-01-01T12:01:00Z", null).replace("\"active\":true", "\"active\":false"));
        stream.evaluate(signal("2026-01-01T12:30:00Z", null).replace("\"active\":true", "\"active\":false"));
        stream.evaluate(signal("2026-01-01T12:25:00Z", "main_power_reconnect")
                .replace("\"active\":true", "\"active\":false"));
        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.CLOSED), kinds());
    }

    @Test
    void aBufferedReconnectClosesTheOpenCase() {
        publish("case.closed_by_operator || " + RECONNECT, null);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));
        stream.evaluate(signal("2026-01-01T12:10:00Z", null));

        stream.evaluate(signal("2026-01-01T12:05:00Z", "main_power_reconnect"));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.CLOSED), kinds());
    }

    @Test
    void aBufferedReconnectIsNotedOnTheOpenCase() {
        publish("case.closed_by_operator", RECONNECT);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));
        stream.evaluate(signal("2026-01-01T12:10:00Z", null));

        stream.evaluate(signal("2026-01-01T12:05:00Z", "main_power_reconnect"));
        stream.evaluate(signal("2026-01-01T12:05:00Z", "main_power_reconnect"));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.NOTED), kinds(), "a redelivery notes nothing");
    }

    @Test
    void aBufferedEventOlderThanTheCaseChangesNothing() {
        publish("case.closed_by_operator || " + RECONNECT, null);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));

        stream.evaluate(signal("2026-01-01T11:55:00Z", "main_power_reconnect"));

        assertEquals(List.of(Transition.Kind.OPENED), kinds());
    }

    @Test
    void aBufferedNoteOlderThanTheCaseChangesNothing() {
        publish("case.closed_by_operator", RECONNECT);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));

        stream.evaluate(signal("2026-01-01T11:55:00Z", "main_power_reconnect"));

        assertEquals(List.of(Transition.Kind.OPENED), kinds());
    }

    @Test
    void aCloseRuleErrorLeavesTheCaseOpen() {
        publish("signal.frame.sensors.panic_button", null);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));
        stream.evaluate(signal("2026-01-01T12:05:00Z", null));
        stream.evaluate(signal("2026-01-01T12:10:00Z", "main_power_disconnect"));

        assertEquals(List.of(Transition.Kind.OPENED), kinds());
    }

    @Test
    void leavingTheOrganizationStillAdvancesRecoveryWithAnEventCloseRule() {
        publish("case.closed_by_operator || " + RECONNECT + " || case.normal_s >= 120", null);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));
        stream.evaluate(withoutOrganization("2026-01-01T12:01:00Z"));
        stream.evaluate(withoutOrganization("2026-01-01T12:02:00Z"));
        stream.evaluate(withoutOrganization("2026-01-01T12:03:00Z"));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.CLOSED), kinds());
    }

    @Test
    void anEventNoteDoesNotBlockRecoveryAfterLeavingTheOrganization() {
        publish("case.normal_s >= 120", RECONNECT);
        stream.evaluate(signal("2026-01-01T12:00:00Z", "main_power_disconnect"));
        stream.evaluate(withoutOrganization("2026-01-01T12:01:00Z"));
        stream.evaluate(withoutOrganization("2026-01-01T12:03:00Z"));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.CLOSED), kinds());
    }

    @Test
    void anEventReadOnlyByTheOpenRuleStillOpensFromABufferedFrame() {
        SymptomSpec spec = new SymptomSpec("gps_signal", "signal.trip.active", null,
                SeedTemplates.get("gps-sabotage").spec().levels(),
                new SymptomSpec.Lifecycle(ACTIVATION, "case.closed_by_operator"), null);
        UUID id = catalog.create(TENANT, "owner@example.com", new CreateRequest("open-event", "Eventos", null,
                null, null, "gps_signal", null, spec)).definition().id();
        catalog.publish(TENANT, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);

        stream.evaluate(signal("2026-01-01T12:10:00Z", null));
        stream.evaluate(signal("2026-01-01T12:05:00Z", "device_tamper"));

        assertTrue(compiled(id).opensOnEvents());
        assertEquals(List.of(Transition.Kind.OPENED), kinds());
    }

    private static String withoutOrganization(String at) {
        return signal(at, null).replace("\"clients\":[\"" + TENANT + "\"]", "\"clients\":[]");
    }

    @Test
    void holdEndStillClosesFromNormalEvidenceWithoutAFrame() {
        UUID id = publish(RECONNECT + " || case.normal_s >= 120", null);
        InMemoryEpisodeStore state = new InMemoryEpisodeStore();
        Instant opened = Instant.parse("2026-01-01T12:00:00Z");
        state.save(TENANT, new Episode(id, "1.0.0", "V1", opened, null, opened.plusSeconds(60), Map.of(),
                opened.plusSeconds(60), opened, 1, 0));

        List<Transition> closed = new SignalEvaluator(state).finishHold(TENANT, "V1", opened.plusSeconds(180),
                List.of(compiled(id)));

        assertEquals(List.of(Transition.Kind.CLOSED), closed.stream().map(Transition::kind).toList());
        assertTrue(state.find(TENANT, "V1", id).isEmpty());
    }

    @Test
    void holdEndDoesNotCloseOnAnUnavailableEvent() {
        UUID id = publish(RECONNECT, null);
        InMemoryEpisodeStore state = new InMemoryEpisodeStore();
        Instant opened = Instant.parse("2026-01-01T12:00:00Z");
        state.save(TENANT, new Episode(id, "1.0.0", "V1", opened, opened, null, Map.of(), opened, opened, 1, 0));

        List<Transition> closed = new SignalEvaluator(state).finishHold(TENANT, "V1", opened.plusSeconds(180),
                List.of(compiled(id)));

        assertTrue(closed.isEmpty());
        assertTrue(state.find(TENANT, "V1", id).orElseThrow().open());
    }

    @Test
    void anySymptomRuleThatReadsAnEventMakesItEventDriven() {
        assertTrue(CompiledSymptom.readsEvents(ACTIVATION));
        assertTrue(CompiledSymptom.readsEvents("signal.frame.?events.orValue([]).size() > 0"));
        assertTrue(CompiledSymptom.readsEvents("signal.?derived.?jamming == TRUE"), "the derived flags still count");
        assertFalse(CompiledSymptom.readsEvents("signal.frame.gps.speed > 90.0"));
        assertFalse(CompiledSymptom.readsEvents("signal.trip.id == 'signal.frame.events'"));

        UUID id = publish("case.closed_by_operator || " + RECONNECT, null);
        assertTrue(compiled(id).opensOnEvents());
        assertTrue(compiled(id).lifecycleOnEvents());
    }

    @Test
    void aCloseRuleThatReadsAnEventMakesAnOrdinarySymptomEventDriven() {
        SymptomSpec sabotage = SeedTemplates.get("gps-sabotage").spec();
        SymptomSpec spec = new SymptomSpec("gps_signal", "signal.trip.active", null, sabotage.levels(),
                new SymptomSpec.Lifecycle("case.condition_s >= 0", "case.closed_by_operator || " + RECONNECT), null);
        UUID id = catalog.create(TENANT, "owner@example.com", new CreateRequest("trip", "En viaje", null, null,
                null, "gps_signal", null, spec)).definition().id();
        catalog.publish(TENANT, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);

        CompiledSymptom s = compiled(id);
        assertFalse(s.opensOnEvents());
        assertTrue(s.lifecycleOnEvents());
        assertTrue(s.eventDriven());
    }

    private CompiledSymptom compiled(UUID id) {
        DataSourceService sources = new DataSourceService(new InMemoryCatalog(), SignalSamples.inMemory());
        return new EvaluatorCatalog(catalog, sources).forSource(TENANT, "gps_signal").symptoms().stream()
                .filter(s -> s.definitionId().equals(id)).findFirst().orElseThrow();
    }
}
