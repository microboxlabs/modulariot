package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.InMemoryLossStore;
import com.microboxlabs.miot.symptoms.lostsignal.LossSettings;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector.TickerSettings;
import com.microboxlabs.miot.symptoms.lostsignal.TripChecks;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A signal arriving between the detector's close and the GPS consumer's close, without timing-dependent threads. */
class OperatorCloseInterleavingTest {

    private static final String TENANT = "tenant-a";
    private static final String ASSET = "vehicle-1";
    private final InterleavingRepository episodes = new InterleavingRepository();
    private final InMemoryTransitionLog log = new InMemoryTransitionLog();
    private final List<Object> published = new ArrayList<>();
    private SymptomEvents events;
    private EvaluatorCatalog evaluatorCatalog;
    private UUID id;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        events = new SymptomEvents(e -> {
            published.add(e);
            return CompletableFuture.completedFuture(null);
        }, store::findDefinition, Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        SymptomCatalogService catalog = new SymptomCatalogService(store, sources,
                new AuditService(new InMemoryAuditStore()));
        SymptomSpec spec = new SymptomSpec("gps_signal", "signal.trip.active && signal.frame.gps.speed >= 80",
                null, Specs.levels("true", "false", "false", "false"),
                new SymptomSpec.Lifecycle("case.condition_s >= 0 && !case.closed_on_trip", "case.normal_s >= 0"), null);
        id = catalog.create(TENANT, "owner@example.com", new CreateRequest("trip-speed", "Velocidad", null,
                null, null, "gps_signal", null, spec)).definition().id();
        catalog.publish(TENANT, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);
        evaluatorCatalog = new EvaluatorCatalog(catalog, sources);
    }

    private EvaluatorStream consumer(EpisodeRepository detectorEpisodes) {
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        Clock clock = Clock.systemUTC();
        TripChecks checks = new TripChecks(evaluatorCatalog, detectorEpisodes, log, events,
                new AuditService(new InMemoryAuditStore()), meters);
        LostSignalDetector detector = new LostSignalDetector(true, new InMemoryLossStore(), LossSettings.defaults(),
                TickerSettings.defaults(), checks, meters, clock);
        return new EvaluatorStream(true, evaluatorCatalog, new EvaluatorStream.Sinks(log, events, meters),
                clock, episodes, SignalSamples.inMemory(), LateFrames.NONE, detector);
    }

    @Test
    void aSignalBetweenTheSharedRepositoryClosesCannotPublishAGhostCase() {
        EvaluatorStream consumer = consumer(episodes);
        consumer.evaluate(signal(0));
        episodes.afterNextClose(() -> {
            // This runs after the detector's atomic close, before the GPS consumer installs the same marker.
            assertEquals(0, consumer.evaluate(signal(1)));
            assertEquals("T-1", episodes.load(TENANT, ASSET).find(TENANT, ASSET, id).orElseThrow().closedOnTrip());
        });

        consumer.forget(TENANT, ASSET, id, "T-1");
        assertEquals(0, consumer.evaluate(signal(2)));

        assertEquals(List.of(Transition.Kind.OPENED), log.recorded.stream().map(Transition::kind).toList(),
                "the interleaved signal adds neither an OPENED nor a CLOSED transition");
        assertEquals(1, published.size(), "the interleaved signal publishes no ghost case event");
        assertEquals("T-1", episodes.load(TENANT, ASSET).find(TENANT, ASSET, id).orElseThrow().closedOnTrip());
    }

    @Test
    void aNoTripCloseStillDeletesTheSharedEpisodeAndAllowsTheNextCase() {
        EvaluatorStream consumer = consumer(episodes);
        consumer.evaluate(signal(0));
        episodes.afterNextClose(() -> assertTrue(episodes.load(TENANT, ASSET).find(TENANT, ASSET, id).isEmpty()));

        consumer.forget(TENANT, ASSET, id);
        assertTrue(episodes.load(TENANT, ASSET).find(TENANT, ASSET, id).isEmpty());
        assertEquals(1, consumer.evaluate(signal(1)));
        assertEquals(List.of(Transition.Kind.OPENED, Transition.Kind.OPENED),
                log.recorded.stream().map(Transition::kind).toList());
    }

    @Test
    void independentMemoryRepositoriesKeepTheSameMarkerAndBothDeleteItWithoutATrip() {
        InMemoryEpisodeRepository detectorEpisodes = new InMemoryEpisodeRepository();
        EvaluatorStream consumer = consumer(detectorEpisodes);
        consumer.evaluate(signal(0));
        AssetEpisodes detectorState = detectorEpisodes.load(TENANT, ASSET);
        detectorState.save(TENANT, episodes.load(TENANT, ASSET).find(TENANT, ASSET, id).orElseThrow());
        detectorEpisodes.save(detectorState);

        consumer.forget(TENANT, ASSET, id, "T-1");

        Episode marker = episodes.load(TENANT, ASSET).find(TENANT, ASSET, id).orElseThrow();
        assertEquals("T-1", marker.closedOnTrip());
        assertEquals(marker, detectorEpisodes.load(TENANT, ASSET).find(TENANT, ASSET, id).orElseThrow());
        consumer.forget(TENANT, ASSET, id);
        assertTrue(episodes.load(TENANT, ASSET).find(TENANT, ASSET, id).isEmpty());
        assertTrue(detectorEpisodes.load(TENANT, ASSET).find(TENANT, ASSET, id).isEmpty());
    }

    private static String signal(int minute) {
        return """
                {"schema":"miot.gps.signal@1","asset_id":"%s","at":"2026-10-22T03:%02d:00Z","clients":["%s"],
                 "trips":{"%s":{"id":"T-1","active":true,"double_driver":false}},
                 "frame":{"asset_id":"%s","gps":{"speed":90},"sensors":{}}}
                """.formatted(ASSET, minute, TENANT, TENANT, ASSET);
    }

    private static class InterleavingRepository extends InMemoryEpisodeRepository {
        private Runnable afterClose;

        void afterNextClose(Runnable work) {
            afterClose = work;
        }

        @Override
        public void operatorClose(String tenant, String asset, UUID definitionId, Episode marker) {
            super.operatorClose(tenant, asset, definitionId, marker);
            Runnable work = afterClose;
            afterClose = null;
            if (work != null) {
                work.run();
            }
        }
    }
}
