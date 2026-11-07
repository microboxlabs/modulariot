package com.microboxlabs.miot.symptoms.duty;

import com.microboxlabs.miot.symptoms.evaluator.CompiledSymptom;
import com.microboxlabs.miot.symptoms.signal.TripCheck;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The {@code trip_check} of each frame for the symptoms that read the duty counters: the frame goes through the
 * vehicle's {@link DutyTracker} for the organization, and the check carries the counters and the organization's
 * trip. The lost-signal detector's checks run the other {@code trip_check} symptoms; these run under their own
 * watermark ({@link #WATERMARK}), since frame time and the detector's clock differ.
 */
public class DutyChecks {

    public static final String WATERMARK = TripCheck.KEY + "@frames";
    public static final String DRIVING = "check.driving_minutes";
    public static final String RESTING = "check.resting_minutes";
    public static final String DUTY = "check.duty_minutes";
    private static final List<String> COUNTERS = List.of(DRIVING, RESTING, DUTY);

    private final DutyTracker tracker;
    private final DutyStore store;

    /** The check of one frame and the state to save once it has been evaluated. */
    public record Check(Map<String, Object> check, DutyState next) {

        /** The check as a case change keeps it, without the trip: the trip is the case's, and holds the driver. */
        public Map<String, Object> context() {
            Map<String, Object> kept = new LinkedHashMap<>(check);
            kept.remove("trip");
            return Map.of(TripCheck.ROOT, kept);
        }
    }

    public DutyChecks(DutyStore store) {
        this(new DutyTracker(), store);
    }

    public DutyChecks(DutyTracker tracker, DutyStore store) {
        this.tracker = tracker;
        this.store = store;
    }

    /** One of its rules reads a duty counter: it runs on each frame, not on the lost-signal checks. */
    public static boolean readsCounters(CompiledSymptom s) {
        return TripCheck.KEY.equals(s.sourceKey()) && COUNTERS.stream().anyMatch(s::reads);
    }

    /** An operator's close of its case restarts the duty count, as when the legacy treatment expires. */
    public static boolean readsDuty(CompiledSymptom s) {
        return TripCheck.KEY.equals(s.sourceKey()) && s.reads(DUTY);
    }

    /**
     * Applies the frame of the organization's signal ({@code signal} as its rules read it, with its own trip).
     * Empty when the frame is not applied: no position, a bad speed or jump, or not newer than the last one.
     */
    public Optional<Check> apply(String tenantCode, String assetId, Instant at, Map<String, Object> signal) {
        return apply(at, signal, store.load(tenantCode, assetId));
    }

    /** As {@link #apply(String, String, Instant, Map)}, on the counters already read from the store. */
    public Optional<Check> apply(Instant at, Map<String, Object> signal, DutyStore.Loaded loaded) {
        DutyState prev = loaded.state();
        if (prev != null && loaded.restarts() > prev.restarts()) {
            prev = DutyTracker.restartDuty(prev, loaded.restarts());
        }
        Map<?, ?> trip = signal.get("trip") instanceof Map<?, ?> t ? t : Map.of();
        String tripId = Boolean.TRUE.equals(trip.get("active")) && trip.get("id") instanceof String id ? id : null;
        DutyTracker.Frame frame = new DutyTracker.Frame(at, number(signal, "latitude"), number(signal, "longitude"),
                number(signal, "speed"), tripId);
        long restarts = loaded.restarts();
        return tracker.step(prev, frame).map(step -> {
            DutyState next = step.next();
            if (next.restarts() != restarts) {
                next = new DutyState(next.at(), next.lat(), next.lon(), next.drive(), next.rest(), restarts);
            }
            Map<String, Object> check = new LinkedHashMap<>();
            check.put("driving_minutes", step.counters().drivingMinutes());
            check.put("resting_minutes", step.counters().restingMinutes());
            check.put("duty_minutes", step.counters().dutyMinutes());
            check.put("signal_lost_minutes", 0.0);
            check.put("trip", trip);
            return new Check(check, next);
        });
    }

    /** Ends the trip when signal access ends, without using the organization's unavailable GPS fields. */
    public Optional<DutyState> endTrip(String tenantCode, String assetId, Instant at) {
        DutyState prev = store.load(tenantCode, assetId).state();
        if (prev == null || !at.isAfter(prev.at())) {
            return Optional.empty();
        }
        return Optional.of(new DutyState(at, prev.lat(), prev.lon(), null, null, prev.restarts()));
    }

    public void save(String tenantCode, String assetId, DutyState next) {
        store.save(tenantCode, assetId, next);
    }

    public void restartDuty(String tenantCode, String assetId) {
        store.restartDuty(tenantCode, assetId);
    }

    /** Where the counters are kept. */
    public DutyStore store() {
        return store;
    }

    private static Double number(Map<String, Object> signal, String key) {
        Object frame = signal.get("frame");
        Object gps = frame instanceof Map<?, ?> f ? f.get("gps") : null;
        Object v = gps instanceof Map<?, ?> g ? g.get(key) : null;
        return v instanceof Number n ? n.doubleValue() : null;
    }
}
