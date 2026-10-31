package com.microboxlabs.miot.symptoms.evaluator.evals;

import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.events.SymptomCaseData;
import com.microboxlabs.miot.symptoms.lostsignal.InMemoryLossStore;
import com.microboxlabs.miot.symptoms.lostsignal.IngestHealth;
import com.microboxlabs.miot.symptoms.lostsignal.LossSettings;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector;
import com.microboxlabs.miot.symptoms.lostsignal.TestClock;
import com.microboxlabs.miot.symptoms.lostsignal.TestEngine;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Replays GPS frames through the lost-signal detector in arrival order, with a simulated clock and a tick every
 * 5 s, and the platform's lost-signal template as an ACTIVE symptom of one organization. No Redis, no database:
 * the in-memory stores behave as the Redis ones.
 */
final class LostSignalReplay {

    static final Instant T0 = EvalTraces.T0;
    static final String TENANT = "tenant";
    private static final int TICK_S = 5;

    /**
     * One frame: taken at {@code at} and arriving at {@code arrives}, seconds from the start.
     *
     * @param onTrip the organization has a trip in progress on the vehicle
     */
    record Frame(String vehicle, String sender, int at, int arrives, double speed, Boolean engine, double lat,
            double lon, boolean onTrip) {
    }

    /** A case change: seconds from the start, vehicle, kind and level. */
    record Change(int at, String vehicle, Transition.Kind kind, int level) {
    }

    /** What the replay produced. */
    record Result(List<Change> changes, List<SymptomCaseData> returns) {

        List<Change> of(String vehicle) {
            return changes.stream().filter(c -> c.vehicle().equals(vehicle)).toList();
        }

        long opened() {
            return changes.stream().filter(c -> c.kind() == Transition.Kind.OPENED).count();
        }

        int topLevel(String vehicle) {
            return of(vehicle).stream().mapToInt(Change::level).max().orElse(0);
        }
    }

    private LostSignalReplay() {
    }

    /** Replays the frames, then keeps ticking until {@code until} seconds. */
    static Result run(List<Frame> frames, int until) {
        TestClock clock = new TestClock(T0);
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        TestEngine engine = new TestEngine(clock);
        engine.publish(TENANT, "signal-loss", SeedTemplates.get("signal-loss").spec(), SymptomState.ACTIVE);
        // Without the ingest guard: a scenario's fleet is a handful of vehicles, all of them silent at times.
        LostSignalDetector detector = new LostSignalDetector(true, new InMemoryLossStore(clock),
                LossSettings.defaults(), new LostSignalDetector.TickerSettings(Duration.ofMinutes(1),
                        Duration.ofDays(1), Duration.ofSeconds(15), 500, new IngestHealth(Duration.ZERO,
                                Duration.ZERO), Duration.ofMinutes(1)),
                engine.trips(meters), meters, clock);
        List<Frame> byArrival = new ArrayList<>(frames);
        byArrival.sort(Comparator.comparingInt(Frame::arrives).thenComparingInt(Frame::at));
        int next = 0;
        for (int now = 0; now <= until; now += TICK_S) {
            while (next < byArrival.size() && byArrival.get(next).arrives() <= now) {
                Frame f = byArrival.get(next++);
                clock.set(T0.plusSeconds(f.arrives()));
                detector.frame(f.vehicle(), T0.plusSeconds(f.at()), T0.plusSeconds(f.arrives()), signal(f));
            }
            clock.set(T0.plusSeconds(now));
            detector.tick();
        }
        List<Change> changes = engine.recorded.stream().map(t -> new Change(
                (int) Duration.between(T0, t.at()).toSeconds(), t.assetId(), t.kind(), t.level())).toList();
        List<SymptomCaseData> returns = engine.fired.stream()
                .filter(e -> e.type().equals("symptom.case.signal_returned"))
                .map(OperationalEvent::data).map(SymptomCaseData.class::cast).toList();
        return new Result(changes, returns);
    }

    private static Map<String, Object> signal(Frame f) {
        Map<String, Object> sensors = f.engine() == null ? Map.of() : Map.of("engine_status", f.engine());
        Map<String, Object> trip = Map.of("active", true, "double_driver", false, "id", "T-" + f.vehicle());
        return Map.of("sender", f.sender(), "trips", f.onTrip() ? Map.of(TENANT, trip) : Map.of(),
                "frame", Map.of("gps", Map.of("speed", f.speed(), "latitude", f.lat(), "longitude", f.lon()),
                        "sensors", sensors));
    }

    /** The frame with no trip in progress. */
    static Frame offTrip(Frame f) {
        return new Frame(f.vehicle(), f.sender(), f.at(), f.arrives(), f.speed(), f.engine(), f.lat(), f.lon(),
                false);
    }

    /** A vehicle reporting every {@code every} s from {@code from} to {@code to}, arriving {@code delay} s later. */
    static List<Frame> steady(String vehicle, String sender, int from, int to, int every, int delay, double speed,
            Boolean engine, double lat, double lon) {
        List<Frame> out = new ArrayList<>();
        for (int t = from; t <= to; t += every) {
            out.add(new Frame(vehicle, sender, t, t + delay, speed, engine, lat, lon, true));
        }
        return out;
    }
}
