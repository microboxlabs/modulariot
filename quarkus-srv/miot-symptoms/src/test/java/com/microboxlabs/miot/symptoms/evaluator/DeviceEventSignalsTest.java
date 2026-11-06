package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Signals of device events received outside the GPS frames ({@code miot.gps.signal.events@1}). */
class DeviceEventSignalsTest {

    private static final String TENANT = "tenant-a";
    private static final String OTHER = "tenant-b";

    private final InMemoryTransitionLog log = new InMemoryTransitionLog();
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final InMemoryEpisodeRepository episodes = new InMemoryEpisodeRepository();
    private SymptomCatalogService catalog;
    private EvaluatorStream stream;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        SymptomEvents events = new SymptomEvents(CompletableFuture::completedFuture, store::findDefinition,
                Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        stream = new EvaluatorStream(true, new EvaluatorCatalog(catalog, sources),
                new EvaluatorStream.Sinks(log, events, meters), Clock.systemUTC(), episodes, SignalSamples.inMemory());
    }

    private UUID publish(String tenant, String template) {
        return publish(tenant, template, SeedTemplates.get(template).spec());
    }

    private UUID publish(String tenant, String key, SymptomSpec spec) {
        UUID id = catalog.create(tenant, "owner@example.com", new CreateRequest(key, key, null, null, null,
                "gps_signal", null, spec)).definition().id();
        catalog.publish(tenant, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);
        return id;
    }

    /** The signal DeviceEvents publishes: one event, the sending organization, its trip when there is one. */
    private static String event(String at, String type, String code, boolean onTrip) {
        String trips = onTrip ? """
                "trips":{"%s":{"active":true,"double_driver":false,"id":"T-1"}},""".formatted(TENANT) : "";
        return """
                {"schema":"miot.gps.signal.events@1","asset_id":"V1","at":"%s","event_id":"e-%s",
                 "clients":["%s"],%s"derived":{"power_disconnected":false,"jamming":false},
                 "frame":{"asset_id":"V1","timestamp":"%s",
                          "events":[{"event_type":"%s","timestamp":"%s","code":"%s"}]}}
                """.formatted(at, at, TENANT, trips, at, type, at, code);
    }

    private static String frame(String tenant, String at) {
        return """
                {"schema":"miot.gps.signal@1","asset_id":"V1","at":"%s","clients":["%s"],
                 "trips":{"%s":{"active":true,"double_driver":false,"id":"T-1"}},
                 "derived":{"moving":true,"power_disconnected":false,"jamming":false},
                 "frame":{"asset_id":"V1","gps":{"speed":80.0},"sensors":{}}}
                """.formatted(at, tenant, tenant);
    }

    private List<Transition> of(UUID definition) {
        return log.recorded.stream().filter(t -> t.definitionId().equals(definition)).toList();
    }

    @Test
    void theDriverAppEmergencyOpensThePanicCaseAtLevelFour() {
        UUID panic = publish(TENANT, "panic-button");

        assertEquals(1, stream.evaluate(event("2026-01-01T12:00:00Z", "Emergencia", "", false)));

        assertEquals(List.of(Transition.Kind.OPENED), of(panic).stream().map(Transition::kind).toList());
        assertEquals(4, of(panic).get(0).level());
        assertEquals(1.0, meters.counter("miot.symptoms.evaluator.device_events").count());
    }

    @Test
    void theCameraCodeSetsTheFatigueLevelOnATrip() {
        UUID fatigue = publish(TENANT, "driver-fatigue");

        stream.evaluate(event("2026-01-01T12:00:00Z", "FYS", "109", false));
        assertTrue(of(fatigue).isEmpty(), "off a trip it opens nothing");

        stream.evaluate(event("2026-01-01T12:01:00Z", "FYS", "109", true));
        assertEquals(4, of(fatigue).get(0).level());
    }

    @Test
    void aRepeatedEventRaisesTheLevelByTheCaseAge() {
        UUID sensor = publish(TENANT, "driver-fatigue-sensor");

        stream.evaluate(event("2026-01-01T12:00:00Z", "FYSS", "111", true));
        stream.evaluate(frame(TENANT, "2026-01-01T12:02:00Z"));
        stream.evaluate(event("2026-01-01T12:06:00Z", "FYSS", "111", true));

        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.LEVEL_CHANGED),
                of(sensor).stream().map(Transition::kind).toList());
        assertEquals(2, of(sensor).get(1).level());
    }

    @Test
    void theEventDoesNotMoveTheWatermarkOfTheVehiclesFrames() {
        UUID onTrip = publish(TENANT, "on-trip", Specs.with(SeedTemplates.get("gps-sabotage").spec(),
                "signal.trip.active"));
        publish(TENANT, "load-securing-absence");

        stream.evaluate(event("2026-01-01T12:10:00Z", "AAS", "", true));
        assertTrue(of(onTrip).isEmpty(), "a symptom that reads no event does not run on it");

        stream.evaluate(frame(TENANT, "2026-01-01T12:05:00Z"));

        assertEquals(1, of(onTrip).size(), "an earlier frame is still on time");
        assertEquals(Instant.parse("2026-01-01T12:05:00Z"),
                episodes.load(TENANT, "V1").watermark(TENANT, "V1", "gps_signal").orElseThrow());
    }

    @Test
    void anotherOrganizationsCasesOnTheVehicleAreLeftAlone() {
        UUID theirs = publish(OTHER, "on-trip", Specs.with(SeedTemplates.get("gps-sabotage").spec(),
                "signal.trip.active"));
        publish(TENANT, "panic-button");
        stream.evaluate(frame(OTHER, "2026-01-01T12:00:00Z"));
        assertEquals(1, of(theirs).size());

        stream.evaluate(event("2026-01-01T12:01:00Z", "Emergencia", "", false));

        assertEquals(1, of(theirs).size(), "their case is not reconciled against our event");
    }
}
