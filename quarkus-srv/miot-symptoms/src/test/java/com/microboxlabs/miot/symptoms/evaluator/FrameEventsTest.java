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

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        SymptomEvents events = new SymptomEvents(e -> {
            published.add(e);
            return CompletableFuture.completedFuture(null);
        }, store::findDefinition, Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        stream = new EvaluatorStream(true, new EvaluatorCatalog(catalog, sources),
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(),
                new InMemoryEpisodeRepository(), SignalSamples.inMemory());
    }

    private UUID publish(String close, String note) {
        SymptomSpec sabotage = SeedTemplates.get("gps-sabotage").spec();
        SymptomSpec spec = new SymptomSpec("gps_signal", ACTIVATION, null, sabotage.levels(),
                new SymptomSpec.Lifecycle("case.condition_s >= 0", close, false, note), null);
        UUID id = catalog.create(TENANT, "owner@example.com", new CreateRequest("events", "Eventos", null, null,
                null, "gps_signal", null, spec)).definition().id();
        catalog.publish(TENANT, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);
        return id;
    }

    /** A frame on a trip with one event of {@code type}, or none when it is null. */
    private static String signal(String at, String type) {
        String events = type == null ? "" : """
                ,"events":[{"event_type":"%s","timestamp":"%s","severity":"high","description":"Evento %s",
                 "additional_info":{"source":"test"}}]""".formatted(type, at, type);
        return """
                {"schema":"miot.gps.signal@1","asset_id":"V1","at":"%s","clients":["%s"],
                 "trips":{"%s":{"active":true,"double_driver":false,"id":"T-1"}},
                 "local_hour":9,"derived":{"moving":true},
                 "frame":{"asset_id":"V1","gps":{"speed":80.0},"sensors":{}%s}}
                """.formatted(at, TENANT, TENANT, events);
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
