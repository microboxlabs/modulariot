package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.EnvelopedMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.events.SymptomCaseData;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache;
import com.microboxlabs.miot.symptoms.signal.SignalBuilder;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EvaluatorStreamTest {

    private static final String DEMO = "tenant-demo";
    private static final String OTHER = "tenant-without-symptoms";

    private final InMemoryTransitionLog log = new InMemoryTransitionLog();
    private final List<Transition> recorded = log.recorded;
    private final List<OperationalEvent> fired = new ArrayList<>();
    private SymptomEvents events;
    private final SignalSamples samples = SignalSamples.inMemory();
    private SymptomCatalogService catalog;
    private EvaluatorCatalog evaluatorCatalog;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        events = new SymptomEvents(e -> {
            fired.add(e);
            return CompletableFuture.completedFuture(e);
        }, store::findDefinition, Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        evaluatorCatalog = new EvaluatorCatalog(catalog, sources);
        publishPanic(DEMO, SymptomState.TEST);
    }

    private void publishPanic(String tenant, SymptomState state) {
        var id = catalog.create(tenant, "owner@example.com", new CreateRequest("panic-button", "Botón de pánico",
                null, null, null, "gps_signal", null, SeedTemplates.get("panic-button").spec()))
                .definition().id();
        catalog.publish(tenant, "owner@example.com", id, "Primera versión", null, state);
    }

    @Test
    @SuppressWarnings("unchecked")
    void keepsEachOrganizationsSignalAsASampleWithoutRoutingFields() {
        EvaluatorStream s = stream();

        s.evaluate(signal("2026-10-22T03:00:30Z", true, OTHER));

        List<Map<String, Object>> kept = samples.recent(OTHER, 5);
        assertEquals(1, kept.size(), "kept even when the organization has no symptoms");
        Map<String, Object> signal = (Map<String, Object>) kept.get(0).get("signal");
        assertEquals("DEMO01", signal.get("asset_id"));
        assertFalse(signal.containsKey("clients"));
        assertFalse(signal.containsKey("schema"));
        Map<String, Object> frame = (Map<String, Object>) signal.get("frame");
        assertFalse(frame.containsKey("asset_id"));
        assertEquals(true, ((Map<String, Object>) frame.get("sensors")).get("panic_button"));
        assertTrue(samples.recent(DEMO, 5).isEmpty());
    }

    private EvaluatorStream stream() {
        return stream(new InMemoryEpisodeRepository());
    }

    private EvaluatorStream stream(EpisodeRepository episodes) {
        return new EvaluatorStream(true, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()),
                Clock.systemUTC(), episodes, samples);
    }

    private static String signal(String at, Boolean panic, String... clients) {
        String sensors = panic == null ? "{}" : "{\"panic_button\":" + panic + "}";
        return """
                {"schema":"miot.gps.signal@1","asset_id":"DEMO01","at":"%s","clients":[%s],
                 "trip":{"active":false,"double_driver":false},
                 "local_hour":9,"derived":{"moving":false},
                 "frame":{"asset_id":"DEMO01","gps":{"speed":0.0},"sensors":%s}}
                """.formatted(at, String.join(",", List.of(clients).stream().map(c -> "\"" + c + "\"").toList()),
                sensors);
    }

    @Test
    void aPanicPressOpensOneCaseForTheOrganizationWithTheSymptom() {
        EvaluatorStream s = stream();

        assertEquals(0, s.evaluate(signal("2026-10-22T03:00:00Z", false, DEMO)));
        assertEquals(1, s.evaluate(signal("2026-10-22T03:00:30Z", true, DEMO, OTHER)));
        assertEquals(0, s.evaluate(signal("2026-10-22T03:01:00Z", true, DEMO)), "still pressed: same case");
        assertEquals(0, s.evaluate(signal("2026-10-22T03:01:30Z", null, DEMO)), "no button field: no rule error");

        assertEquals(1, recorded.size());
        Transition opened = recorded.get(0);
        assertEquals(Kind.OPENED, opened.kind());
        assertEquals(4, opened.level());
        assertEquals(SymptomState.TEST, opened.state());
        assertEquals("DEMO01", opened.assetId());
    }

    @Test
    void organizationsWithoutSymptomsAndOldSignalsAreIgnored() {
        EvaluatorStream s = stream();

        assertEquals(0, s.evaluate(signal("2026-10-22T03:00:30Z", true, OTHER)));
        assertEquals(1, s.evaluate(signal("2026-10-22T03:00:30Z", true, DEMO)));
        assertEquals(0, s.evaluate(signal("2026-10-22T03:00:00Z", true, DEMO)), "older than the last applied");
    }

    @Test
    void aLateSignalIsCountedAndHandedToTheHookAndRunsOnlyEventSymptoms() {
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        List<String> late = new ArrayList<>();
        EvaluatorStream s = new EvaluatorStream(true, evaluatorCatalog, new EvaluatorStream.Sinks(log, events, meters),
                Clock.systemUTC(), new InMemoryEpisodeRepository(), samples,
                (tenant, asset, at, newest, signal) -> late.add(tenant + " " + asset + " " + at + " < " + newest),
                com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector.off());

        s.evaluate(signal("2026-10-22T03:00:30Z", false, DEMO));
        assertEquals(1, s.evaluate(signal("2026-10-22T03:00:00Z", true, DEMO, OTHER)), "a buffered panic press");
        assertEquals(0, s.evaluate(signal("2026-10-22T03:00:30Z", true, DEMO)), "a replay is not late");

        assertEquals(List.of(DEMO + " DEMO01 2026-10-22T03:00:00Z < 2026-10-22T03:00:30Z"), late,
                "only the organization with symptoms has a watermark");
        assertEquals(List.of(Kind.OPENED), recorded.stream().map(Transition::kind).toList(),
                "panic reads a device event: the late press opens its case");
        assertEquals(1.0, meters.counter("miot.symptoms.evaluator.late", "sender", "none").count());
    }

    @Test
    void aFailingLateHookIsCountedAndTheSignalStillAcknowledged() {
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        EvaluatorStream s = new EvaluatorStream(true, evaluatorCatalog, new EvaluatorStream.Sinks(log, events, meters),
                Clock.systemUTC(), new InMemoryEpisodeRepository(), samples,
                (tenant, asset, at, newest, signal) -> {
                    throw new IllegalStateException("hook down");
                }, com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector.off());
        List<String> outcomes = new ArrayList<>();

        s.onSignal(message(signal("2026-10-22T03:00:30Z", false, DEMO), outcomes));
        s.onSignal(message(signal("2026-10-22T03:00:00Z", true, DEMO), outcomes));

        assertEquals(List.of("ack", "ack"), outcomes, "a failed hook is not redelivered");
        assertEquals(1, recorded.size(), "the late press still opens the panic case");
        assertEquals(1.0, meters.counter("miot.symptoms.evaluator.late_hook_failed").count());
        assertEquals(1.0, meters.counter("miot.symptoms.evaluator.late", "sender", "none").count());
    }

    @Test
    void theLateCounterIsTaggedWithTheSendersPrefix() {
        assertEquals("abcdefgh", EvaluatorStream.senderTag("abcdefgh-long-m2m-id"));
        assertEquals("short", EvaluatorStream.senderTag("short"));
        assertEquals("none", EvaluatorStream.senderTag(null));
    }

    @Test
    void doesNothingWhenOff() {
        EvaluatorStream off = new EvaluatorStream(false, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()),
                Clock.systemUTC(), new InMemoryEpisodeRepository(), samples);

        assertEquals(0, off.evaluate(signal("2026-10-22T03:00:30Z", true, DEMO)));
    }

    @Test
    void episodesSurviveARoundTripThroughJson() {
        Episode e = new Episode(java.util.UUID.randomUUID(), "1.0.0", "DEMO01",
                java.time.Instant.parse("2026-10-22T03:00:00Z"), null, null,
                java.util.Map.of(4, java.time.Instant.parse("2026-10-22T03:00:00Z")),
                java.time.Instant.parse("2026-10-22T03:00:30Z"), java.time.Instant.parse("2026-10-22T03:00:30Z"),
                4, 0, java.time.Instant.parse("2026-10-22T03:00:30Z"));

        assertEquals(e, RedisEpisodes.read(RedisEpisodes.write(e)));
    }

    @Test
    void oneScriptWritesAndDeletesTheEpisodes() {
        java.util.UUID kept = java.util.UUID.randomUUID();
        java.util.UUID gone = java.util.UUID.randomUUID();
        AssetEpisodes state = new AssetEpisodes(DEMO, "DEMO01",
                java.util.Map.of(gone, Episode.start(gone, "1.0.0", "DEMO01")), java.util.Map.of());
        state.save(DEMO, Episode.start(kept, "1.0.0", "DEMO01"));
        state.delete(DEMO, "DEMO01", gone);
        state.setWatermark(DEMO, "DEMO01", "gps_signal", java.time.Instant.ofEpochMilli(1000));

        List<String> args = RedisEpisodes.saveArgs(state, java.time.Duration.ofDays(7));

        assertEquals(List.of("2", "symptoms:ep:" + DEMO + ":DEMO01", "symptoms:ep-tenants:DEMO01", "604800",
                "2", "1", DEMO), args.subList(1, 8));
        assertEquals("ep:" + gone, args.get(args.size() - 1));
        assertEquals(13, args.size());
    }

    @Test
    void aFailedStoreIsRetriedAndAMalformedSignalIsNot() {
        InMemoryEpisodeRepository memory = new InMemoryEpisodeRepository();
        EpisodeRepository failing = new EpisodeRepository() {
            @Override
            public java.util.Set<String> tenantsWithEpisodes(String assetId) {
                return memory.tenantsWithEpisodes(assetId);
            }

            @Override
            public AssetEpisodes load(String tenantCode, String assetId) {
                return memory.load(tenantCode, assetId);
            }

            @Override
            public void save(AssetEpisodes changes) {
                throw new IllegalStateException("Redis down");
            }

            @Override
            public void forget(String tenantCode, String assetId, java.util.UUID definitionId) {
                memory.forget(tenantCode, assetId, definitionId);
            }
        };
        EvaluatorStream s = new EvaluatorStream(true, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()),
                Clock.systemUTC(), failing, samples);
        List<String> outcomes = new ArrayList<>();

        s.onSignal(message(signal("2026-10-22T03:00:30Z", true, DEMO), outcomes));
        s.onSignal(message(signal("2026-10-22T03:00:30Z", true, DEMO), outcomes));
        s.onSignal(message("not json", outcomes));

        assertEquals(List.of("nack", "nack", "ack"), outcomes);
        assertEquals(1, recorded.size(), "the transition is written before the episode");
        assertEquals(1, fired.size(), "the redelivered signal publishes nothing again");
    }

    @Test
    void aTestSymptomPublishesItsOpeningAsATestEvent() {
        stream().evaluate(signal("2026-10-22T03:00:30Z", true, DEMO));

        assertEquals(1, fired.size());
        OperationalEvent e = fired.get(0);
        assertEquals("symptom.case.opened", e.type());
        assertEquals("miot-symptoms", e.source());
        assertEquals(DEMO, e.tenantCode());
        assertEquals(java.time.Instant.parse("2026-10-22T03:00:30Z"), e.at());
        assertEquals("symptom_case", e.context().kind());
        assertEquals("-1", e.context().key());
        assertTrue(e.test());
        SymptomCaseData data = (SymptomCaseData) e.data();
        assertEquals(-1, data.symptomId());
        assertEquals("panic-button", data.symptomKey());
        assertEquals("Botón de pánico", data.symptomName());
        assertEquals(4, data.level());
        assertEquals(0, data.previousLevel());
        assertEquals("DEMO01", data.assetId());
        assertEquals(0.0, data.speedKmh());
    }

    @Test
    void anActiveCaseOpeningRisingAndClosingPublishesThreeEvents() {
        String tenant = "tenant-speed";
        SymptomSpec spec = new SymptomSpec("gps_signal", "signal.frame.gps.speed > 0",
                new SymptomSpec.Measure("signal.frame.gps.speed", "Velocidad", "km/h"),
                Specs.levels("measure > 0 && measure < 80", "measure >= 80 && measure < 100",
                        "measure >= 100 && measure < 120", "measure >= 120"),
                new SymptomSpec.Lifecycle("case.condition_s >= 0", "case.normal_s >= 0"), null);
        var id = catalog.create(tenant, "owner@example.com", new CreateRequest("speed-band", "Velocidad", null,
                null, null, "gps_signal", null, spec)).definition().id();
        catalog.publish(tenant, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);
        EvaluatorStream s = stream();

        s.evaluate(moving("2026-10-22T03:00:00Z", 50, tenant));
        s.evaluate(moving("2026-10-22T03:00:30Z", 90, tenant));
        s.evaluate(moving("2026-10-22T03:01:00Z", 0, tenant));

        assertEquals(List.of("symptom.case.opened", "symptom.case.level_changed", "symptom.case.closed"),
                fired.stream().map(OperationalEvent::type).toList());
        assertTrue(fired.stream().noneMatch(OperationalEvent::test));
        assertTrue(fired.stream().allMatch(e -> e.context().key().equals("-1")), "one case");
        SymptomCaseData rose = (SymptomCaseData) fired.get(1).data();
        assertEquals(2, rose.level());
        assertEquals(1, rose.previousLevel());
        assertEquals(90.0, rose.measure());
        assertEquals(90.0, rose.speedKmh());
        assertEquals(id, rose.definitionId());
        assertEquals("T-9", rose.tripId());
        assertEquals("D-7", rose.driverId());
        assertEquals("speed-band", rose.symptomKey());
        assertEquals("Velocidad", rose.symptomName());
        SymptomCaseData closed = (SymptomCaseData) fired.get(2).data();
        assertEquals(2, closed.level());
        assertEquals(null, closed.closedBy());
    }

    @Test
    void aTripOnlyClientsCaseClosesAfterItsTripIsRemoved() throws Exception {
        SymptomSpec spec = new SymptomSpec("gps_signal", "signal.trip.active && signal.frame.gps.speed >= 80",
                null, Specs.levels("true", "false", "false", "false"),
                new SymptomSpec.Lifecycle("case.condition_s >= 0", "case.normal_s >= 120"), null);
        var id = catalog.create(DEMO, "owner@example.com", new CreateRequest("trip-speed", "Velocidad", null,
                null, null, "gps_signal", null, spec)).definition().id();
        catalog.publish(DEMO, "owner@example.com", id, "First version", null, SymptomState.ACTIVE);
        ReferenceCache refs = new ReferenceCache();
        refs.load(List.of(new ReferenceCache.Trip("T-1", DEMO, "DEMO01", "v", "in_transit",
                Instant.parse("2026-10-22T02:00:00Z"), null, false)), List.of());
        InMemoryEpisodeRepository episodes = new InMemoryEpisodeRepository();
        EvaluatorStream s = stream(episodes);

        assertEquals(2, s.evaluate(builtSignal(refs, "2026-10-22T03:00:00Z")), "speed and panic open");
        s = stream(episodes);
        refs.applyTrip("T-1", null);
        assertEquals(List.of("sender"), refs.clientsAt("DEMO01", "sender", Instant.parse("2026-10-22T03:00:30Z")));
        assertEquals(0, s.evaluate(builtSignal(refs, "2026-10-22T03:00:30Z")), "normal timer starts");
        assertEquals(0, s.evaluate(builtSignal(refs, "2026-10-22T03:00:20Z")), "an older frame cannot move it back");
        assertEquals(0, s.evaluate(builtSignal(refs, "2026-10-22T03:02:00Z")), "only 90 seconds normal");
        assertEquals(1, s.evaluate(builtSignal(refs, "2026-10-22T03:02:30Z")));
        assertEquals(0, s.evaluate(builtSignal(refs, "2026-10-22T03:02:30Z")), "a replay does not close twice");
        assertEquals(0, s.evaluate(builtSignal(refs, "2026-10-22T03:03:00Z")), "no new case without access");

        assertEquals(List.of(Kind.OPENED, Kind.OPENED, Kind.CLOSED), recorded.stream().map(Transition::kind).toList());
        assertEquals(id, recorded.get(2).definitionId(), "the operator-only panic case stays open");
        SymptomCaseData closed = (SymptomCaseData) fired.get(2).data();
        assertNull(closed.speedKmh(), "reconciliation carries no GPS data");
        assertNull(closed.tripId());
        assertEquals(1, samples.recent(DEMO, 20).size());
    }

    private static String builtSignal(ReferenceCache refs, String at) throws Exception {
        EnvelopedMessage frame = EnvelopedMessage.fromJson("""
                {"clientId":"sender@clients","payload":{"asset_id":"DEMO01","timestamp":"%s",
                 "gps":{"speed":90,"latitude":-33.4,"longitude":-70.6},"sensors":{"panic_button":true}}}
                """.formatted(at));
        return new ObjectMapper().registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .writeValueAsString(new SignalBuilder(refs, ZoneId.of("UTC")).build(frame).orElseThrow());
    }

    private static String moving(String at, double speed, String client) {
        return """
                {"schema":"miot.gps.signal@1","asset_id":"DEMO01","at":"%s","clients":["%s"],
                 "trips":{"%s":{"id":"T-9","active":true,"double_driver":false,
                                "driver":{"id":"D-7","registered":true}}},
                 "local_hour":9,"derived":{"moving":true},
                 "frame":{"asset_id":"DEMO01","gps":{"speed":%s,"latitude":-33.4,"longitude":-70.6},"sensors":{}}}
                """.formatted(at, client, client, speed);
    }

    @Test
    @SuppressWarnings("unchecked")
    void eachOrganizationReadsOnlyItsOwnTrip() {
        Map<String, Object> signal = Map.of("asset_id", "DEMO01", "clients", List.of(DEMO, OTHER),
                "trips", Map.of(DEMO, Map.of("id", "T-1", "active", true)));

        Map<String, Object> demo = EvaluatorStream.forTenant(signal, DEMO);
        Map<String, Object> other = EvaluatorStream.forTenant(signal, OTHER);

        assertEquals("T-1", ((Map<String, Object>) demo.get("trip")).get("id"));
        assertEquals(Map.of("active", false, "double_driver", false), other.get("trip"));
        assertFalse(demo.containsKey("trips"));
        assertFalse(other.containsKey("trips"));
    }

    @Test
    void eachOrganizationReadsOnlyItsOwnZones() {
        Map<String, Object> signal = Map.of("asset_id", "DEMO01", "clients", List.of(DEMO, OTHER),
                "geos", Map.of(DEMO, Map.of("risk_zone", true, "outside_authorized", true)));

        Map<String, Object> demo = EvaluatorStream.forTenant(signal, DEMO);
        Map<String, Object> other = EvaluatorStream.forTenant(signal, OTHER);

        assertEquals(Map.of("risk_zone", true, "outside_authorized", true), demo.get("geo"));
        assertFalse(other.containsKey("geo"), "an organization without zones gets none");
        assertFalse(demo.containsKey("geos"));
    }

    private static org.eclipse.microprofile.reactive.messaging.Message<byte[]> message(String body,
            List<String> outcomes) {
        return org.eclipse.microprofile.reactive.messaging.Message.of(
                body.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                () -> {
                    outcomes.add("ack");
                    return java.util.concurrent.CompletableFuture.completedFuture(null);
                },
                e -> {
                    outcomes.add("nack");
                    return java.util.concurrent.CompletableFuture.completedFuture(null);
                });
    }
}
