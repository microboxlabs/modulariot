package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.StaleCase;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.AssetEpisodes;
import com.microboxlabs.miot.symptoms.evaluator.Episode;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorCatalog;
import com.microboxlabs.miot.symptoms.evaluator.Holds;
import com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeRepository;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.events.SymptomCaseData;
import com.microboxlabs.miot.symptoms.service.AuditService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** A trip's end closes its lost-signal cases and stops the checks of its vehicle. */
class TripEndTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final String TENANT = "tenant-a";

    private final TestClock clock = new TestClock(T0);
    private final InMemoryLossStore store = new InMemoryLossStore(clock);
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final TestEngine engine = new TestEngine(clock);
    private final FakeTrips tripsModule = new FakeTrips();
    private final LostSignalDetector detector = new LostSignalDetector(true, store, LossSettings.defaults(),
            new LostSignalDetector.TickerSettings(Duration.ofMinutes(1), Duration.ofDays(1), Duration.ofSeconds(15),
                    500, new IngestHealth(Duration.ZERO, Duration.ZERO), Duration.ofMinutes(1)),
            engine.trips(meters, tripsModule), meters, clock);

    /** The trips module as {@code PgTripEnds} reads it: ended trips, and the cases on the engine's log. */
    private final class FakeTrips implements TripEnds {
        final Map<String, State> states = new HashMap<>();
        final Set<Integer> closed = new HashSet<>();
        int reads;

        @Override
        public Map<String, State> states(Map<String, String> tripByTenant) {
            reads++;
            Map<String, State> out = new HashMap<>();
            tripByTenant.forEach((tenant, trip) -> {
                State s = states.get(trip);
                if (s != null) {
                    out.put(tenant, s);
                }
            });
            return out;
        }

        @Override
        public List<StaleCase> close(String tenant, String tripId, List<UUID> definitionIds, Instant at) {
            List<StaleCase> out = new ArrayList<>();
            for (int i = 0; i < engine.recorded.size(); i++) {
                Transition t = engine.recorded.get(i);
                if (t.kind() == Transition.Kind.OPENED && tripId.equals(engine.places.get(i).tripId())
                        && (definitionIds == null || definitionIds.contains(t.definitionId())) && closed.add(i)) {
                    out.add(new StaleCase(tenant, i + 1L, t.definitionId(), t.version(), false, t.assetId(),
                            t.level(), tripId, null, null, null, t.at()));
                }
            }
            return out;
        }
    }

    private static Map<String, Object> signal(String trip) {
        return Map.of("sender", "S1",
                "trips", Map.of(TENANT, Map.of("active", true, "id", trip,
                        "destination", Map.of("id", 17, "visited", false))),
                "frame", Map.of("gps", Map.of("speed", 80.0, "latitude", -33.0, "longitude", -71.0),
                        "sensors", Map.of("engine_status", true)));
    }

    private void frame(String trip, int at) {
        clock.set(T0.plusSeconds(at + 5));
        detector.frame("V1", T0.plusSeconds(at), T0.plusSeconds(at + 5), signal(trip));
    }

    private void tickUntil(int until) {
        while (clock.instant().isBefore(T0.plusSeconds(until))) {
            clock.advance(5);
            detector.tick();
        }
    }

    private void template() {
        engine.publish(TENANT, "signal-loss", SeedTemplates.get("signal-loss").spec(), SymptomState.ACTIVE);
    }

    private List<Transition.Kind> kinds() {
        return engine.recorded.stream().map(Transition::kind).toList();
    }

    @Test
    void theTripEndClosesItsCaseAtAnyLevelAndTheTickerNeitherEscalatesNorReopensIt() {
        template();
        frame("T-1", 0);
        tickUntil(1830);
        assertEquals(2, engine.recorded.get(engine.recorded.size() - 1).level(), "level 2 before the trip ends");

        tripsModule.states.put("T-1", new TripEnds.State(true, false));
        assertEquals(1, detector.tripChanged(TENANT, "T-1"), "the trips module's notice");

        assertEquals("symptom.case.closed", engine.types().get(engine.types().size() - 1));
        SymptomCaseData closed = (SymptomCaseData) engine.fired.get(engine.fired.size() - 1).data();
        assertEquals(TripEnds.REASON, closed.closedBy());
        assertEquals("T-1", closed.tripId());
        assertEquals(-1, closed.symptomId());

        int recorded = engine.recorded.size();
        tickUntil(20_000);
        assertEquals(recorded, engine.recorded.size(), "no level change and no new case after the end");
        assertNull(store.deadline("V1"), "the vehicle is checked no more");
        assertTrue(store.vehicle("V1").check() == null || store.vehicle("V1").check().cases().isEmpty());
        assertEquals(0, detector.tripChanged(TENANT, "T-1"), "a repeated notice closes nothing");
    }

    /** A case the frame evaluator opened (speed, ETA deviation, rest) on the vehicle's trip. */
    private UUID evaluatorCase(String asset, String trip) {
        UUID definition = UUID.randomUUID();
        engine.log.append(TENANT, List.of(new Transition(Transition.Kind.OPENED, definition, "1.0.0",
                SymptomState.ACTIVE, asset, T0, 2, 0, 95)),
                new com.microboxlabs.miot.symptoms.evaluator.TransitionLog.Place(trip, null, null, null, null));
        return definition;
    }

    @Test
    void theTripEndClosesTheEvaluatorsCasesAndLeavesAnotherTripsCaseOpen() {
        UUID ended = evaluatorCase("V1", "T-1");
        UUID next = evaluatorCase("V1", "T-2");
        tripsModule.states.put("T-1", new TripEnds.State(true, false));

        assertEquals(1, detector.tripChanged(TENANT, "T-1"), "no lost-signal symptom is needed");

        SymptomCaseData closed = (SymptomCaseData) engine.fired.get(engine.fired.size() - 1).data();
        assertEquals(ended, closed.definitionId());
        assertEquals(TripEnds.REASON, closed.closedBy());
        assertEquals("T-1", closed.tripId());
        assertEquals(Set.of(0), tripsModule.closed, "the case on T-2 stays open");
        assertTrue(engine.fired.stream().noneMatch(e -> e.data() instanceof SymptomCaseData d
                && d.definitionId().equals(next)));
        assertEquals(0, detector.tripChanged(TENANT, "T-1"), "a repeated notice closes nothing");
    }

    @Test
    void aMissedTripEndIsFoundByTheNextCheck() {
        template();
        frame("T-1", 0);
        tickUntil(1830);
        int recorded = engine.recorded.size();

        tripsModule.states.put("T-1", new TripEnds.State(true, false));
        tickUntil(1900);

        assertEquals(recorded, engine.recorded.size(), "no transition after the end");
        assertEquals(TripEnds.REASON, ((SymptomCaseData) engine.fired.get(engine.fired.size() - 1).data())
                .closedBy());
        assertEquals(1, tripsModule.closed.size());
        assertNull(store.deadline("V1"));
        tickUntil(20_000);
        assertEquals(recorded, engine.recorded.size());
    }

    @Test
    void aCheckOnAVehicleWhoseTripEndedOpensNothing() {
        template();
        frame("T-1", 0);
        tripsModule.states.put("T-1", new TripEnds.State(true, false));

        tickUntil(5000);

        assertTrue(engine.recorded.isEmpty(), "no case opened");
        assertTrue(engine.fired.isEmpty());
        assertEquals(1.0, meters.counter("miot.symptoms.lost_signal.checks", "outcome", "no_trip").count());
        assertNull(store.deadline("V1"));
    }

    @Test
    void aCancelledTripEndsLikeACompletedOne() {
        // PgTripEnds reads completed, cancelled and missing trips as ended (PgTripEndsTest); the checks see one state.
        template();
        frame("T-1", 0);
        tickUntil(300);
        tripsModule.states.put("T-1", new TripEnds.State(true, false));

        assertEquals(1, detector.tripChanged(TENANT, "T-1"));
        assertEquals(List.of(Transition.Kind.OPENED), kinds());
        tickUntil(3000);
        assertEquals(List.of(Transition.Kind.OPENED), kinds());
    }

    @Test
    void aNewTripOfTheVehicleStartsClean() {
        template();
        frame("T-1", 0);
        tickUntil(1830);
        tripsModule.states.put("T-1", new TripEnds.State(true, false));
        detector.tripChanged(TENANT, "T-1");
        tickUntil(1900);
        int before = engine.recorded.size();

        frame("T-2", 5000);
        // The 5000 s gap is in the vehicle's profile now, so its next loss is called later.
        tickUntil(25_000);

        List<Transition> after = engine.recorded.subList(before, engine.recorded.size());
        assertEquals(Transition.Kind.OPENED, after.get(0).kind(), "a new case, not a level change of the old one");
        assertEquals(0, after.get(0).previousLevel(), "from no case: its level is the silence it found");
        assertEquals("T-2", engine.places.get(engine.places.size() - 1).tripId());
    }

    @Test
    void aDelayedTripEndPreservesANewerCaseAndAnOperatorsCloseMarker() {
        UUID id = engine.publish(TENANT, "signal-loss", SeedTemplates.get("signal-loss").spec(), SymptomState.ACTIVE);
        InMemoryEpisodeRepository episodes = new InMemoryEpisodeRepository();
        Episode newer = new Episode(id, "1.0.0", "NEW", T0, T0, null, Map.of(), T0.plusSeconds(60),
                T0.plusSeconds(60), 1, 30, SymptomState.ACTIVE);
        Episode old = new Episode(id, "1.0.0", "OLD", T0, T0, null, Map.of(), T0, T0, 1, 30,
                SymptomState.ACTIVE);
        Episode marker = Episode.closedOnTrip(id, "MANUAL", "T-2", T0.plusSeconds(60));
        for (Episode e : List.of(newer, old, marker)) {
            AssetEpisodes state = episodes.load(TENANT, e.assetId());
            state.save(TENANT, e);
            episodes.save(state);
        }
        TripEnds closedTrips = new TripEnds() {
            @Override
            public Map<String, State> states(Map<String, String> tripByTenant) {
                return Map.of(TENANT, new State(true, false));
            }

            @Override
            public List<StaleCase> close(String tenant, String tripId, List<UUID> definitionIds, Instant at) {
                return List.of("NEW", "OLD", "MANUAL").stream()
                        .map(asset -> new StaleCase(tenant, 1L, id, "1.0.0", false, asset, 1, tripId,
                                null, null, null, T0))
                        .toList();
            }
        };
        TripChecks checks = new TripChecks(new EvaluatorCatalog(engine.catalog, engine.sources), episodes,
                engine.log, engine.events, new AuditService(engine.audits), meters, Holds.NONE, closedTrips);

        assertEquals(3, checks.tripChanged(TENANT, "T-1", T0.plusSeconds(120)));

        assertEquals(newer, episodes.load(TENANT, "NEW").find(TENANT, "NEW", id).orElseThrow(),
                "a new case opened after the database closed the old trip's case");
        assertTrue(episodes.load(TENANT, "OLD").find(TENANT, "OLD", id).isEmpty(),
                "the closed case's episode is removed");
        assertEquals(marker, episodes.load(TENANT, "MANUAL").find(TENANT, "MANUAL", id).orElseThrow(),
                "a concurrent operator close on the next trip survives");
    }

    @Test
    void aTripChangeThatIsNotItsEndClosesNothing() {
        template();
        frame("T-1", 0);
        tickUntil(300);

        assertEquals(0, detector.tripChanged(TENANT, "T-1"), "the trips module has nothing to say");
        tripsModule.states.put("T-1", new TripEnds.State(false, true));
        assertEquals(0, detector.tripChanged(TENANT, "T-1"), "arrived, not ended");
        assertEquals(List.of(Transition.Kind.OPENED), kinds());
    }

    @Test
    @SuppressWarnings("unchecked")
    void aConfirmedArrivalReachesTheCheckOfASilentVehicle() {
        template();
        frame("T-1", 0);
        tickUntil(300);
        tripsModule.states.put("T-1", new TripEnds.State(false, true));

        LossStore.Vehicle v = store.vehicle("V1");
        TripChecks.Ended read = engine.trips(meters, tripsModule).endedTrips(v,
                v.check() == null ? CheckState.NONE : v.check(), clock.instant());

        Map<String, Object> destination = (Map<String, Object>) read.vehicle().watch().trips().get(TENANT)
                .get("destination");
        assertEquals(true, destination.get("visited"));
        assertEquals(17, destination.get("id"));
        assertTrue(read.tenants().isEmpty());
        assertEquals(false, ((Map<String, Object>) store.vehicle("V1").watch().trips().get(TENANT)
                .get("destination")).get("visited"), "only the check reads it; the stored watch is the frame's");
    }

    @Test
    void aFailedTripReadRetriesTheCheck() {
        template();
        TripEnds failing = new TripEnds() {
            @Override
            public Map<String, State> states(Map<String, String> tripByTenant) {
                throw new IllegalStateException("database unavailable");
            }

            @Override
            public List<StaleCase> close(String tenant, String tripId, List<UUID> definitionIds, Instant at) {
                return List.of();
            }
        };
        LostSignalDetector blind = new LostSignalDetector(true, store, LossSettings.defaults(),
                new LostSignalDetector.TickerSettings(Duration.ofMinutes(1), Duration.ofDays(1),
                        Duration.ofSeconds(15), 500, new IngestHealth(Duration.ZERO, Duration.ZERO),
                        Duration.ofMinutes(1)), engine.trips(meters, failing), meters, clock);
        clock.set(T0.plusSeconds(5));
        blind.frame("V1", T0, T0.plusSeconds(5), signal("T-1"));
        clock.set(T0.plusSeconds(300));

        assertEquals(0, blind.tick());
        assertTrue(engine.recorded.isEmpty(), "no case opened without knowing the trip");
        assertEquals(1.0, meters.counter("miot.symptoms.lost_signal.check_failed").count());
        assertEquals(T0.plusSeconds(185), store.deadline("V1"), "still due");
    }
}
