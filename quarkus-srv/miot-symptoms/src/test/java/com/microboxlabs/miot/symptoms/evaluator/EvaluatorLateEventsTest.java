package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A buffered device event that arrives after a newer fix still opens its case; ordinary symptoms skip it. */
class EvaluatorLateEventsTest {

    private static final String TENANT = "tenant-a";

    private final InMemoryTransitionLog log = new InMemoryTransitionLog();
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private SymptomCatalogService catalog;
    private EvaluatorStream stream;
    private UUID sabotage;
    private UUID ordinary;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        SymptomEvents events = new SymptomEvents(e -> CompletableFuture.completedFuture(e), store::findDefinition,
                Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        sabotage = publish("gps-sabotage", SeedTemplates.get("gps-sabotage").spec());
        // An ordinary symptom that holds on every signal of a trip: it must never see a late frame.
        ordinary = publish("on-trip", Specs.with(SeedTemplates.get("gps-sabotage").spec(), "signal.trip.active"));
        stream = new EvaluatorStream(true, new EvaluatorCatalog(catalog, sources),
                new EvaluatorStream.Sinks(log, events, meters), Clock.systemUTC(), new InMemoryEpisodeRepository(),
                SignalSamples.inMemory());
    }

    private UUID publish(String key, SymptomSpec spec) {
        UUID id = catalog.create(TENANT, "owner@example.com", new CreateRequest(key, key, null, null, null,
                "gps_signal", null, spec)).definition().id();
        catalog.publish(TENANT, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);
        return id;
    }

    private static String signal(String at, boolean power, boolean jamming) {
        return """
                {"schema":"miot.gps.signal@1","asset_id":"V1","at":"%s","clients":["%s"],
                 "trips":{"%s":{"active":true,"double_driver":false,"id":"T-1"}},
                 "local_hour":9,"derived":{"moving":true,"power_disconnected":%s,"jamming":%s},
                 "frame":{"asset_id":"V1","gps":{"speed":80.0},"sensors":{}}}
                """.formatted(at, TENANT, TENANT, power, jamming);
    }

    private List<Transition> opened(UUID definition) {
        return log.recorded.stream().filter(t -> t.kind() == Transition.Kind.OPENED
                && t.definitionId().equals(definition)).toList();
    }

    @Test
    void aBufferedJammingEventAfterANewerFixOpensOneCase() {
        stream.evaluate(signal("2026-01-01T12:10:00Z", false, false));

        stream.evaluate(signal("2026-01-01T12:05:00Z", false, true));

        assertEquals(1, opened(sabotage).size(), "the late jamming event opens the case");
        assertEquals(1.0, meters.counter("miot.symptoms.evaluator.late", "sender", "none").count(),
                "still counted as late");
    }

    @Test
    void aBufferedPowerCutAfterANewerFixOpensOneCase() {
        stream.evaluate(signal("2026-01-01T12:10:00Z", false, false));

        stream.evaluate(signal("2026-01-01T12:05:00Z", true, false));

        assertEquals(1, opened(sabotage).size());
    }

    @Test
    void aLateFrameChangesNothingForAnOrdinarySymptom() {
        stream.evaluate(signal("2026-01-01T12:10:00Z", false, false));
        List<Transition> before = List.copyOf(log.recorded);

        stream.evaluate(signal("2026-01-01T12:05:00Z", false, false));

        assertEquals(before, log.recorded, "no event in it: nothing runs");
        assertEquals(1, opened(ordinary).size(), "the ordinary case opened once, on the current fix");
    }

    @Test
    void aRepeatedLateEventOpensNothingNew() {
        stream.evaluate(signal("2026-01-01T12:10:00Z", false, false));
        stream.evaluate(signal("2026-01-01T12:05:00Z", false, true));

        stream.evaluate(signal("2026-01-01T12:05:00Z", false, true));
        stream.evaluate(signal("2026-01-01T12:06:00Z", true, false));

        assertEquals(1, opened(sabotage).size(), "the case is open: a redelivery or another late event adds none");
    }

    @Test
    void theEventDrivenSymptomsAreThoseWhoseActivationReadsADeviceEvent() {
        assertTrue(CompiledSymptom.readsEvents(SeedTemplates.get("gps-sabotage").spec().activation()));
        assertTrue(CompiledSymptom.readsEvents(SeedTemplates.get("panic-button").spec().activation()));
        assertFalse(CompiledSymptom.readsEvents("signal.trip.active && signal.local_hour >= 21"));
    }
}
