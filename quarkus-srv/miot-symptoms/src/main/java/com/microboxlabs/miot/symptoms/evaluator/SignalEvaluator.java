package com.microboxlabs.miot.symptoms.evaluator;

import static com.microboxlabs.miot.symptoms.evaluator.Episode.seconds;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.PreparedRule;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleResult;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Runs published symptom versions on one vehicle's signals, in order, and
 * keeps each case's episode.
 *
 * <ul>
 * <li>The activation says whether a signal is a candidate; the measure and the
 * levels set its level.</li>
 * <li>{@code held_s} depends on the level's rule. A rule that holds given
 * enough time (such as {@code measure >= 21 && held_s >= 60}) counts from
 * the first signal where it would hold, so the time is how long the measure
 * met that threshold; while it waits, and no level holds, the case is at the
 * applying level below it. Any other rule (such as
 * {@code held_s >= 600 && held_s < 1200}) counts from the start of
 * the activation's run. {@code open_s} is the time since the case opened,
 * 0 while none is open.</li>
 * <li>The condition holds while a candidate reaches a level.
 * {@code case.condition_s} counts from its first signal, {@code case.normal_s}
 * from the first signal after it stopped, and is -1 while it holds. The
 * lifecycle opens and closes the case.</li>
 * <li>After an operator closes a case on a trip ({@link OperatorClose}), the symptom opens no new case on that
 * vehicle and trip while the condition holds, unless the level rises above {@link Episode#reopenAbove()} (the
 * closed case's level after a handled close, none after an invalidation). One signal where the condition does not
 * hold ends the block. Without an episode, the block is read back from the log's last CLOSED row.</li>
 * <li>Per vehicle and source, a signal not newer than the last one applied is
 * ignored. A case's level only rises, unless the lifecycle lets it follow the
 * measure down while the condition holds. After a case closes, a condition that
 * still holds starts a new run. A new version keeps the open case but restarts
 * the levels' hold times. An episode with nothing running is not kept.</li>
 * <li>An open case keeps the state it opened in. When the symptom has moved to the other state (TEST and
 * ACTIVE), the next signal closes that case in its own state ({@link Transition#STATE_CHANGE_REASON}) and does
 * nothing else; the signal after it may open a case in the new state.</li>
 * <li>While a hold covers an ACTIVE symptom ({@link Holds}), its open case
 * keeps its level and may still close; a case that would open does not, and
 * the first such opening of a run is returned as a {@code HELD} transition.
 * The hold times are cleared on every held signal, so once the hold ends
 * the time to the next level counts from the first signal after it.</li>
 * </ul>
 */
public class SignalEvaluator {

    /** {@code held_s} for asking whether a level's rule holds given enough time. */
    private static final double FOREVER = 1e9;
    /** {@code case.normal_s} while the condition holds. */
    static final double NOT_NORMAL = -1;
    private static final String SIGNAL = "signal";
    private static final String OPEN_S = "open_s";
    private static final String LIFECYCLE_CLOSE = "lifecycle.close";
    private static final String LEVEL_SECTION = "levels.";

    private final EpisodeStore store;
    private final Holds holds;

    /** One symptom's rules failed on a signal; its episode is left as it was. */
    public record RuleError(UUID definitionId, String version, String section, String message) {
    }

    public record Result(List<Transition> transitions, List<RuleError> errors) {
    }

    private static final class RuleFailure extends RuntimeException {
        private final String section;

        RuleFailure(String section, String message) {
            super(message, null, false, false);
            this.section = section;
        }
    }

    public SignalEvaluator(EpisodeStore store) {
        this(store, Holds.NONE);
    }

    public SignalEvaluator(EpisodeStore store, Holds holds) {
        this.store = store;
        this.holds = holds;
    }

    /** Applies the close rule to the latest condition evidence and restarts escalation at the return time. */
    public List<Transition> finishHold(String tenant, String asset, Instant at, List<CompiledSymptom> symptoms) {
        List<Transition> closed = new ArrayList<>();
        for (CompiledSymptom s : symptoms) {
            Episode e = store.find(tenant, asset, s.definitionId()).orElse(null);
            if (e == null) {
                continue;
            }
            if (stale(e, s)) {
                closed.add(closedByStateChange(e, s, asset, at));
                store.delete(tenant, asset, s.definitionId());
            } else if (e.open() && closesWithoutSignal(s, caseFields(e.conditionSince(), e.normalSince(), e.openedAt(),
                    e.level(), at, e.offTripSince()))) {
                closed.add(transition(Kind.CLOSED, s, asset, at, e.level(), e.level(), e.maxMeasure()));
                store.delete(tenant, asset, s.definitionId());
            } else {
                Map<Integer, Instant> restarted = new HashMap<>();
                e.levelSince().keySet().forEach(level -> restarted.put(level, at));
                store.save(tenant, new Episode(e.definitionId(), e.version(), asset, at, e.conditionSince(),
                        e.normalSince(), restarted, e.lastSignalAt(), e.openedAt(), e.level(), e.maxMeasure(),
                        e.state(), e.closedOnTrip(), e.closedOnTripAt(), e.offTripSince(), e.tripId(), e.lastContext(),
                        e.tripEnded(), e.reopenAbove()));
            }
        }
        return closed;
    }

    /** A close rule that needs the signal cannot hold without one. */
    private static boolean closesWithoutSignal(CompiledSymptom s, Map<String, Object> vars) {
        try {
            return condition(s.close(), vars, LIFECYCLE_CLOSE);
        } catch (RuleFailure f) {
            return false;
        }
    }

    /**
     * Advances existing episodes whose activation is false without GPS input, such as a rule requiring an active
     * trip after access ends. An activation that needs unavailable fields is unknown and leaves its episode alone.
     */
    public Result reconcile(String tenantCode, String assetId, Instant at, Map<String, Object> source,
            List<CompiledSymptom> symptoms) {
        Map<String, Object> root = RuleLanguage.converted(source);
        return evaluate(tenantCode, assetId, at, root, inactive(tenantCode, assetId, root, symptoms));
    }

    /** Reconciles a producer's existing episodes under its own clock. */
    public Result reconcileUnder(String watermark, String tenantCode, String assetId, Instant at,
            Map<String, Object> source, List<CompiledSymptom> symptoms) {
        Map<String, Object> root = RuleLanguage.converted(source);
        List<CompiledSymptom> inactive = inactive(tenantCode, assetId, root, symptoms);
        return inactive.isEmpty() ? new Result(List.of(), List.of())
                : evaluateUnder(watermark, tenantCode, assetId, at, root, inactive);
    }

    private List<CompiledSymptom> inactive(String tenantCode, String assetId, Map<String, Object> root,
            List<CompiledSymptom> symptoms) {
        return symptoms.stream()
                .filter(s -> store.find(tenantCode, assetId, s.definitionId()).isPresent())
                .filter(s -> {
                    RuleResult activation = s.activation().run(root);
                    return activation.ok() && Boolean.FALSE.equals(activation.value());
                }).toList();
    }

    /**
     * @param source the source object the rules read, keyed by the source's root name (e.g. {@code signal})
     */
    public Result evaluate(String tenantCode, String assetId, Instant at, Map<String, Object> source,
            List<CompiledSymptom> symptoms) {
        Map<String, Object> root = RuleLanguage.converted(source);
        List<Transition> transitions = new ArrayList<>();
        List<RuleError> errors = new ArrayList<>();
        Map<String, List<CompiledSymptom>> bySource = new LinkedHashMap<>();
        symptoms.forEach(s -> bySource.computeIfAbsent(s.sourceKey(), k -> new ArrayList<>()).add(s));
        bySource.forEach((sourceKey, group) -> run(sourceKey, tenantCode, assetId, at, root, group, transitions,
                errors));
        return new Result(transitions, errors);
    }

    /**
     * As {@link #evaluate}, with every symptom under the watermark {@code watermark} instead of its source's, for
     * checks of one source that come from two producers with their own clocks.
     */
    public Result evaluateUnder(String watermark, String tenantCode, String assetId, Instant at,
            Map<String, Object> source, List<CompiledSymptom> symptoms) {
        Map<String, Object> root = RuleLanguage.converted(source);
        List<Transition> transitions = new ArrayList<>();
        List<RuleError> errors = new ArrayList<>();
        run(watermark, tenantCode, assetId, at, root, symptoms, transitions, errors);
        return new Result(transitions, errors);
    }

    @SuppressWarnings("java:S107") // The evaluation's inputs and the two lists it fills.
    private void run(String watermark, String tenantCode, String assetId, Instant at, Map<String, Object> root,
            List<CompiledSymptom> group, List<Transition> transitions, List<RuleError> errors) {
        Optional<Instant> last = store.watermark(tenantCode, assetId, watermark);
        if (last.isPresent() && !at.isAfter(last.get())) {
            return;
        }
        for (CompiledSymptom s : group) {
            try {
                transitions.addAll(withOperator(s, step(tenantCode, assetId, at, root, s, last.isEmpty()), root, errors));
            } catch (RuleFailure f) {
                errors.add(new RuleError(s.definitionId(), s.version(), f.section, f.getMessage()));
            }
        }
        store.setWatermark(tenantCode, assetId, watermark, at);
    }

    /**
     * A frame older than the watermark, for the event-driven symptoms only. A symptom whose activation reads an
     * event, holds and has no open case takes the frame as a normal step, so a buffered event opens its case. A
     * step that does not open the case is undone, so an older frame never seeds hold-time state. An open case
     * whose close or note rule reads an event runs only those two rules on it, when the frame is not older than
     * the case. A repeat may raise the open case's level without changing its timers. The watermark stays, and an open case opens nothing new.
     */
    public Result evaluateLate(String tenantCode, String assetId, Instant at, Map<String, Object> source,
            List<CompiledSymptom> symptoms) {
        return evaluateLate(tenantCode, assetId, at, source, symptoms, false);
    }

    /** An ended-trip fact also lets an explicitly opted-in ordinary symptom evaluate its buffered frame. */
    public Result evaluateLate(String tenantCode, String assetId, Instant at, Map<String, Object> source,
            List<CompiledSymptom> symptoms, boolean afterTripEnd) {
        Map<String, Object> root = RuleLanguage.converted(source);
        List<Transition> transitions = new ArrayList<>();
        List<RuleError> errors = new ArrayList<>();
        for (CompiledSymptom s : symptoms) {
            Optional<Episode> before = store.find(tenantCode, assetId, s.definitionId());
            if ((!s.eventDriven() && !(afterTripEnd && s.allowsAfterTripEnd())) || before.filter(e -> stale(e, s)).isPresent()) {
                // A late frame leaves a case of the old state to the next frame in order.
                continue;
            }
            try {
                List<Transition> changes = new ArrayList<>();
                try {
                    if (before.filter(Episode::open).isPresent()) {
                        if (!at.isBefore(before.get().openedAt())) {
                            lateWhileOpen(tenantCode, at, root, s, before.get(), changes);
                        }
                    } else {
                        changes.addAll(lateOpening(tenantCode, assetId, at, root, s, before, afterTripEnd));
                    }
                } finally {
                    transitions.addAll(withOperator(s, changes, root, errors));
                }
            } catch (RuleFailure f) {
                errors.add(new RuleError(s.definitionId(), s.version(), f.section, f.getMessage()));
            }
        }
        return new Result(transitions, errors);
    }

    private void lateWhileOpen(String tenantCode, Instant at, Map<String, Object> root,
            CompiledSymptom s, Episode e, List<Transition> transitions) {
        Optional<Transition> lifecycle = s.lifecycleOnEvents() ? lateLifecycle(tenantCode, at, root, s, e)
                : Optional.empty();
        lifecycle.ifPresent(transitions::add);
        if (lifecycle.filter(t -> t.kind() == Kind.CLOSED).isEmpty()) {
            lateLevel(tenantCode, at, root, s, e).ifPresent(transitions::add);
        }
    }

    /** A buffered repeat may raise a case's level, preserving the latest signal and every run timer. */
    private Optional<Transition> lateLevel(String tenantCode, Instant at, Map<String, Object> root,
            CompiledSymptom s, Episode e) {
        if (!s.opensOnEvents() || (s.state() == SymptomState.ACTIVE
                && holds.held(tenantCode, e.assetId(), s.definitionId(), e.openedAt()))) {
            return Optional.empty();
        }
        Reading r = read(s, e, root, at);
        if (r.level() <= e.level()) {
            return Optional.empty();
        }
        store.save(tenantCode, new Episode(e.definitionId(), e.version(), e.assetId(), e.candidateSince(),
                e.conditionSince(), e.normalSince(), e.levelSince(), e.lastSignalAt(), e.openedAt(), r.level(),
                Math.max(e.maxMeasure(), r.measure()), e.state() != null ? e.state() : s.state(),
                e.closedOnTrip(), e.closedOnTripAt(), e.offTripSince(), e.tripId(), e.lastContext(), e.tripEnded()));
        return Optional.of(transition(Kind.LEVEL_CHANGED, s, e.assetId(), at, r.level(), e.level(), r.measure()));
    }

    /** A buffered event may open a case, but must not leave partial hold-time state behind. */
    private List<Transition> lateOpening(String tenantCode, String assetId, Instant at, Map<String, Object> root,
            CompiledSymptom s, Optional<Episode> before, boolean afterTripEnd) {
        // A buffered frame cannot prove the vehicle has left the newer trip an operator closed a case on.
        if (before.map(Episode::closedOnTrip).filter(trip -> !trip.equals(tripId(root))).isPresent()) {
            return List.of();
        }
        if ((!s.opensOnEvents() && !(afterTripEnd && s.allowsAfterTripEnd())) || !condition(s.activation(), root, "activation")) {
            return List.of();
        }
        List<Transition> transitions = step(tenantCode, assetId, at, root, s,
                store.watermark(tenantCode, assetId, s.sourceKey()).isEmpty()).stream()
                .filter(t -> t.kind() == Kind.OPENED || t.kind() == Kind.HELD).toList();
        if (transitions.stream().noneMatch(t -> t.kind() == Kind.OPENED)) {
            before.ifPresentOrElse(e -> store.save(tenantCode, e),
                    () -> store.delete(tenantCode, assetId, s.definitionId()));
        }
        return transitions;
    }

    /** The close rule, else the note rule, on a late frame of an open case; the level and the runs stay. */
    private Optional<Transition> lateLifecycle(String tenantCode, Instant at, Map<String, Object> root,
            CompiledSymptom s, Episode e) {
        Map<String, Object> vars = lifecycleVars(root,
                caseFields(e.conditionSince(), e.normalSince(), e.openedAt(), e.level(), at, e.offTripSince()));
        if (condition(s.close(), vars, LIFECYCLE_CLOSE)) {
            Episode closed = new Episode(s.definitionId(), s.version(), e.assetId(), null, null, e.normalSince(),
                    Map.of(), e.lastSignalAt(), null, 0, 0);
            if (closed.worthKeeping()) {
                store.save(tenantCode, closed);
            } else {
                store.delete(tenantCode, e.assetId(), s.definitionId());
            }
            return Optional.of(transition(Kind.CLOSED, s, e.assetId(), at, e.level(), e.level(), e.maxMeasure()));
        }
        return Optional.ofNullable(note(s, e.assetId(), at, e.level(), vars));
    }

    /** Each opening and level change with whether its case goes to the operators at its new level. */
    private static List<Transition> withOperator(CompiledSymptom s, List<Transition> changes, Map<String, Object> root,
            List<RuleError> errors) {
        if (changes.isEmpty() || s.operators().isEmpty()) {
            return changes;
        }
        List<Transition> out = new ArrayList<>(changes.size());
        for (Transition t : changes) {
            boolean moves = t.kind() == Kind.OPENED || t.kind() == Kind.LEVEL_CHANGED;
            out.add(moves ? t.withOperator(operator(s, t.level(), root, errors)) : t);
        }
        return out;
    }

    /**
     * The level's {@code operator}, and when it has one its {@code operatorWhen} on this signal. A condition that
     * reads a missing value sends no operator. Other failures are reported without discarding the transition.
     */
    static boolean operator(CompiledSymptom s, int level, Map<String, Object> root, List<RuleError> errors) {
        CompiledSymptom.Operator rule = s.operators().getOrDefault(level, CompiledSymptom.Operator.NONE);
        if (!rule.required()) {
            return false;
        }
        if (rule.when() == null) {
            return true;
        }
        String section = LEVEL_SECTION + level + ".response.operatorWhen";
        RuleResult r = rule.when().run(root);
        if (!r.ok()) {
            errors.add(new RuleError(s.definitionId(), s.version(), section, r.error()));
            return false;
        }
        if (!(r.value() instanceof Boolean b)) {
            errors.add(new RuleError(s.definitionId(), s.version(), section, "La condición debe dar sí o no."));
            return false;
        }
        return b;
    }

    /** What one signal says about one symptom, before the lifecycle runs. */
    private record Reading(boolean active, double measure, int level, Instant candidateSince,
            Map<Integer, Instant> levelSince, Instant conditionSince, Instant normalSince) {
    }

    private List<Transition> step(String tenantCode, String assetId, Instant at, Map<String, Object> root,
            CompiledSymptom s, boolean recoverClose) {
        Optional<Episode> found = store.find(tenantCode, assetId, s.definitionId());
        if (found.filter(old -> stale(old, s)).isPresent()) {
            store.delete(tenantCode, assetId, s.definitionId());
            return List.of(closedByStateChange(found.get(), s, assetId, at));
        }
        Episode e = found.orElseGet(() -> recoverEpisode(tenantCode, assetId, s, recoverClose));
        Reading r = read(s, e, root, at);
        boolean held = s.state() == SymptomState.ACTIVE
                && holds.held(tenantCode, assetId, s.definitionId(), e.openedAt());
        Step next = e.open() ? whileOpen(s, e, at, r, held, root) : whileClosed(s, e, at, r, held, root);
        if (next.episode().worthKeeping()) {
            store.save(tenantCode, next.episode());
        } else if (e.lastSignalAt() != null || e.closedOnTrip() != null) {
            store.delete(tenantCode, assetId, s.definitionId());
        }
        List<Transition> out = new ArrayList<>(2);
        if (next.transition() != null) {
            out.add(next.transition());
        }
        if (next.note() != null) {
            out.add(next.note());
        }
        return out;
    }

    private Episode recoverEpisode(String tenant, String asset, CompiledSymptom s, boolean recoverClose) {
        // Recover before reading the rules: a malformed first frame must not lose the operator's decision.
        // Once the source progressed, a normal or other-trip frame may already have cleared the block.
        Optional<Episode> marker = recoverClose ? store.lastOperatorClose(tenant, asset, s.definitionId())
                .map(c -> c.marker(s.definitionId(), asset)) : Optional.empty();
        marker.ifPresent(e -> store.save(tenant, e));
        return marker.orElseGet(() -> Episode.start(s.definitionId(), s.version(), asset));
    }

    private static Reading read(CompiledSymptom s, Episode e, Map<String, Object> root, Instant at) {
        if (!condition(s.activation(), root, "activation")) {
            return new Reading(false, 0, 0, null, Map.of(), null, firstNonNull(e.normalSince(), at));
        }
        Instant candidateSince = firstNonNull(e.candidateSince(), at);
        double measure = measure(s, root);
        Map<Integer, Instant> previous = s.version().equals(e.version()) ? e.levelSince() : Map.of();
        LevelReading levels = levels(s, root, measure, candidateSince, previous, e.openedAt(), at);
        boolean active = levels.level() > 0;
        return new Reading(active, measure, levels.level(), candidateSince, levels.since(),
                active ? firstNonNull(e.conditionSince(), at) : null,
                active ? null : firstNonNull(e.normalSince(), at));
    }

    private record LevelReading(int level, Map<Integer, Instant> since) {
    }

    /** The highest level that holds; if none does, the level below the lowest one waiting for its hold time. */
    private static LevelReading levels(CompiledSymptom s, Map<String, Object> root, double measure,
            Instant candidateSince, Map<Integer, Instant> previous, Instant openedAt, Instant at) {
        Map<String, Object> vars = new LinkedHashMap<>(root);
        vars.put("measure", measure);
        vars.put(OPEN_S, openedAt == null ? 0.0 : seconds(openedAt, at));
        Map<Integer, Instant> since = new HashMap<>();
        int reached = 0;
        int floor = 0;
        int below = 0;
        for (Map.Entry<Integer, PreparedRule> l : s.levels().entrySet()) {
            String section = LEVEL_SECTION + l.getKey();
            vars.put("held_s", FOREVER);
            boolean holdQualified = condition(l.getValue(), vars, section);
            Instant start = candidateSince;
            if (holdQualified) {
                start = previous.getOrDefault(l.getKey(), at);
                since.put(l.getKey(), start);
            }
            vars.put("held_s", seconds(start, at));
            if (condition(l.getValue(), vars, section)) {
                reached = l.getKey();
            } else if (holdQualified && floor == 0) {
                floor = below;
            }
            below = l.getKey();
        }
        return new LevelReading(reached > 0 ? reached : floor, since);
    }

    /** @param note a timeline entry the note rule wrote on the open case, or null */
    private record Step(Episode episode, Transition transition, Transition note) {

        Step(Episode episode, Transition transition) {
            this(episode, transition, null);
        }
    }

    /**
     * A closed episode's {@code level} is 0, or while a hold keeps its opening back the level it would have opened
     * at, so the evidence is recorded once per run.
     */
    private Step whileClosed(CompiledSymptom s, Episode e, Instant at, Reading r, boolean held,
            Map<String, Object> root) {
        // An operator's close holds for the trip it was on; another trip, or none, clears it.
        String marker = e.closedOnTrip() != null && e.closedOnTrip().equals(tripId(root)) ? e.closedOnTrip() : null;
        Instant markedAt = marker == null ? null : e.closedOnTripAt();
        // The block lasts while the condition holds on that trip; one normal signal ends it.
        Integer reopenAbove = reopenAbove(e, marker, r);
        if (reopenAbove != null && r.level() <= reopenAbove) {
            return new Step(new Episode(s.definitionId(), s.version(), e.assetId(), r.candidateSince(),
                    r.conditionSince(), r.normalSince(), r.levelSince(), at, null, 0, 0, null, marker, markedAt, null,
                    null, null, false, reopenAbove), null);
        }
        if (r.active()
                && condition(s.open(), lifecycleVars(root,
                        caseFields(r.conditionSince(), r.normalSince(), null, r.level(), at, marker, markedAt)),
                        "lifecycle.open")) {
            if (held) {
                Episode kept = new Episode(s.definitionId(), s.version(), e.assetId(), null, r.conditionSince(),
                        r.normalSince(), Map.of(), at, null, r.level(), 0, null, marker, markedAt, null, null, null,
                        false, reopenAbove);
                Transition evidence = e.level() == 0
                        ? transition(Kind.HELD, s, e.assetId(), at, r.level(), 0, r.measure())
                        : null;
                return new Step(kept, evidence);
            }
            int initial = initialLevel(s, e, r, reopenAbove);
            Episode opened = new Episode(s.definitionId(), s.version(), e.assetId(), r.candidateSince(),
                    r.conditionSince(), r.normalSince(), r.levelSince(), at, at, initial, r.measure(), s.state(),
                    null, null, offTrip(root) ? at : null, activeTripId(root), Map.of());
            return new Step(opened, transition(Kind.OPENED, s, e.assetId(), at, initial, 0, r.measure()));
        }
        return new Step(new Episode(s.definitionId(), s.version(), e.assetId(), r.candidateSince(),
                r.conditionSince(), r.normalSince(), r.levelSince(), at, null, 0, 0, null, marker, markedAt, null,
                null, null, false, reopenAbove), null);
    }

    private static int initialLevel(CompiledSymptom s, Episode e, Reading r, Integer reopenAbove) {
        if (reopenAbove != null) return r.level();
        return e.level() > 0 ? s.levels().keySet().iterator().next() : r.level();
    }

    private static Integer reopenAbove(Episode e, String marker, Reading r) {
        // After losing timers, a level waiting for held_s still qualifies for the ongoing condition.
        boolean ongoing = r.active() || !r.levelSince().isEmpty();
        return marker != null && ongoing ? e.reopenAbove() : null;
    }

    /** The trip id the source carries ({@code signal.trip.id}, {@code check.trip.id}), or null. */
    static String tripId(Map<String, Object> root) {
        for (Object source : root.values()) {
            if (source instanceof Map<?, ?> m && m.get("trip") instanceof Map<?, ?> trip
                    && trip.get("id") instanceof String id) {
                return id;
            }
        }
        return null;
    }

    /** The id of the active trip the source carries, or null. */
    static String activeTripId(Map<String, Object> root) {
        for (Object source : root.values()) {
            if (source instanceof Map<?, ?> m && m.get("trip") instanceof Map<?, ?> trip
                    && Boolean.TRUE.equals(trip.get("active")) && trip.get("id") instanceof String id) {
                return id;
            }
        }
        return null;
    }

    private Step whileOpen(CompiledSymptom s, Episode e, Instant at, Reading r, boolean held,
            Map<String, Object> root) {
        Instant offTripSince = offTrip(root) ? firstNonNull(e.offTripSince(), at) : null;
        // Down only while the condition still holds: a normal signal leaves the case at its level until it closes.
        // A held case stays where it is.
        int level;
        if (held) {
            level = e.level();
        } else {
            level = s.levelDown() && r.active() ? r.level() : Math.max(e.level(), r.level());
        }
        double max = r.active() ? Math.max(e.maxMeasure(), r.measure()) : e.maxMeasure();
        Map<String, Object> vars = lifecycleVars(root,
                caseFields(r.conditionSince(), r.normalSince(), e.openedAt(), level, at, offTripSince));
        if (condition(s.close(), vars, LIFECYCLE_CLOSE)) {
            // A condition that still holds starts a new run on the next signal.
            Episode closed = new Episode(s.definitionId(), s.version(), e.assetId(), null, null, r.normalSince(),
                    Map.of(), at, null, 0, 0);
            return new Step(closed, transition(Kind.CLOSED, s, e.assetId(), at, level, e.level(), max));
        }
        Map<Integer, Instant> since = new HashMap<>(r.levelSince());
        if (held) {
            since.replaceAll((key, value) -> at);
        }
        // An episode written before the state was kept takes the symptom's state: a stale one was closed at startup.
        Episode kept = new Episode(s.definitionId(), s.version(), e.assetId(), held ? null : r.candidateSince(),
                r.conditionSince(), r.normalSince(), since, at, e.openedAt(), level, max,
                e.state() != null ? e.state() : s.state(), e.closedOnTrip(), e.closedOnTripAt(), offTripSince,
                e.tripId(), e.lastContext(), e.tripId() != null && !e.tripId().equals(activeTripId(root)));
        Transition changed = level != e.level()
                ? transition(Kind.LEVEL_CHANGED, s, e.assetId(), at, level, e.level(), r.measure())
                : null;
        return new Step(kept, changed, note(s, e.assetId(), at, level, vars));
    }

    /**
     * The note rule's timeline entry on an open case, or null when the symptom has none or it does not hold. The
     * entry names the first of the frame's events the rule holds for on its own; none when it holds only for the
     * frame as a whole.
     */
    private static Transition note(CompiledSymptom s, String assetId, Instant at, int level,
            Map<String, Object> vars) {
        if (s.note() == null || !condition(s.note(), vars, "lifecycle.note")) {
            return null;
        }
        Map<String, Object> note = new LinkedHashMap<>();
        Map<String, Object> event = matchingEvent(s.note(), vars);
        if (!event.isEmpty()) {
            note.put("event_type", event.get("event_type"));
            note.put("description", event.get("description"));
        }
        Object eventAt = event.get("timestamp");
        note.put("at", eventAt instanceof String t && !t.isBlank() ? t : at.toString());
        return new Transition(Kind.NOTED, s.definitionId(), s.version(), s.state(), assetId, at, level, level, 0,
                Map.of("note", note));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> matchingEvent(PreparedRule rule, Map<String, Object> vars) {
        if (!(vars.get(SIGNAL) instanceof Map<?, ?> signal) || !(signal.get("frame") instanceof Map<?, ?> frame)
                || !(frame.get("events") instanceof List<?> events)) {
            return Map.of();
        }
        for (Object e : events) {
            Map<String, Object> oneFrame = new LinkedHashMap<>((Map<String, Object>) frame);
            oneFrame.put("events", List.of(e));
            Map<String, Object> oneSignal = new LinkedHashMap<>((Map<String, Object>) signal);
            oneSignal.put("frame", oneFrame);
            Map<String, Object> one = new LinkedHashMap<>(vars);
            one.put(SIGNAL, oneSignal);
            RuleResult r = rule.run(one);
            if (r.ok() && Boolean.TRUE.equals(r.value()) && e instanceof Map<?, ?> m) {
                return (Map<String, Object>) m;
            }
        }
        return Map.of();
    }

    /** An open case in a state the symptom no longer has: the symptom moved between TEST and ACTIVE. */
    private static boolean stale(Episode e, CompiledSymptom s) {
        return e.open() && e.state() != null && e.state() != s.state();
    }

    /** Closes the case in the state and version it runs on, so its CLOSED row matches its OPENED row. */
    private static Transition closedByStateChange(Episode e, CompiledSymptom s, String assetId, Instant at) {
        return new Transition(Kind.CLOSED, s.definitionId(), e.version(), e.state(), assetId, at, e.level(),
                e.level(), e.maxMeasure(), Map.of("reason", Transition.STATE_CHANGE_REASON, "from", e.state().name(),
                        "to", s.state().name()));
    }

    /** What a lifecycle rule reads: the source's root object and the case. */
    private static Map<String, Object> lifecycleVars(Map<String, Object> root, Map<String, Object> caseFields) {
        Map<String, Object> vars = new LinkedHashMap<>(root);
        vars.putAll(caseFields);
        return vars;
    }

    private static Transition transition(Kind kind, CompiledSymptom s, String assetId, Instant at, int level,
            int previous, double measure) {
        return new Transition(kind, s.definitionId(), s.version(), s.state(), assetId, at, level, previous, measure);
    }

    /** The {@code case} object the lifecycle reads. */
    private static Map<String, Object> caseFields(Instant conditionSince, Instant normalSince, Instant openedAt,
            int level, Instant at, Instant offTripSince) {
        return caseFields(conditionSince, normalSince, openedAt, level, at, null, null, offTripSince);
    }

    private static Map<String, Object> caseFields(Instant conditionSince, Instant normalSince, Instant openedAt,
            int level, Instant at, String closedOnTrip, Instant closedOnTripAt) {
        return caseFields(conditionSince, normalSince, openedAt, level, at, closedOnTrip, closedOnTripAt, null);
    }

    @SuppressWarnings("java:S107")
    private static Map<String, Object> caseFields(Instant conditionSince, Instant normalSince, Instant openedAt,
            int level, Instant at, String closedOnTrip, Instant closedOnTripAt, Instant offTripSince) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("condition_s", seconds(conditionSince, at));
        fields.put("normal_s", normalSince == null ? NOT_NORMAL : seconds(normalSince, at));
        fields.put("age_h", seconds(openedAt, at) / 3600);
        fields.put("level", (double) level);
        fields.put("closed_by_operator", false);
        fields.put("off_trip_s", offTripSince == null ? NOT_NORMAL : seconds(offTripSince, at));
        fields.put("closed_on_trip", closedOnTrip != null);
        double closedOnTripSeconds = NOT_NORMAL;
        if (closedOnTrip != null) {
            closedOnTripSeconds = closedOnTripAt == null ? FOREVER : seconds(closedOnTripAt, at);
        }
        fields.put("closed_on_trip_s", closedOnTripSeconds);
        return Map.of("case", fields);
    }

    private static boolean offTrip(Map<String, Object> root) {
        return root.values().stream().anyMatch(source -> source instanceof Map<?, ?> value
                && value.get("trip") instanceof Map<?, ?> trip && Boolean.FALSE.equals(trip.get("active")));
    }

    private static double measure(CompiledSymptom s, Map<String, Object> root) {
        if (s.measure() == null) {
            return 0;
        }
        RuleResult r = s.measure().run(root);
        if (!r.ok()) {
            throw new RuleFailure("measure", r.error());
        }
        if (!(r.value() instanceof Number n)) {
            throw new RuleFailure("measure", "La medida debe dar un número.");
        }
        return n.doubleValue();
    }

    private static boolean condition(PreparedRule rule, Map<String, Object> vars, String section) {
        RuleResult r = rule.run(vars);
        if (!r.ok()) {
            throw new RuleFailure(section, r.error());
        }
        if (!(r.value() instanceof Boolean b)) {
            throw new RuleFailure(section, "La condición debe dar sí o no.");
        }
        return b;
    }

    private static Instant firstNonNull(Instant kept, Instant now) {
        return kept == null ? now : kept;
    }
}
