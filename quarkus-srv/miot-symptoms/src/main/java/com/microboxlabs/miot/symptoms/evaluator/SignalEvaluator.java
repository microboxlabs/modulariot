package com.microboxlabs.miot.symptoms.evaluator;

import static com.microboxlabs.miot.symptoms.evaluator.Episode.seconds;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.PreparedRule;
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
 * the activation's run.</li>
 * <li>The condition holds while a candidate reaches a level.
 * {@code case.condition_s} counts from its first signal, {@code case.normal_s}
 * from the first signal after it stopped, and is -1 while it holds. The
 * lifecycle opens and closes the case.</li>
 * <li>Per vehicle and source, a signal not newer than the last one applied is
 * ignored. A case's level only rises, unless the lifecycle lets it follow the
 * measure down while the condition holds. After a case closes, a condition that
 * still holds starts a new run. A new version keeps the open case but restarts
 * the levels' hold times. An episode with nothing running is not kept.</li>
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
            if (e.open() && condition(s.close(), caseFields(e.conditionSince(), e.normalSince(), e.openedAt(),
                    e.level(), at), "lifecycle.close")) {
                closed.add(transition(Kind.CLOSED, s, asset, at, e.level(), e.level(), e.maxMeasure()));
                store.delete(tenant, asset, s.definitionId());
            } else {
                Map<Integer, Instant> restarted = new HashMap<>();
                e.levelSince().keySet().forEach(level -> restarted.put(level, at));
                store.save(tenant, new Episode(e.definitionId(), e.version(), asset, at, e.conditionSince(),
                        e.normalSince(), restarted, e.lastSignalAt(), e.openedAt(), e.level(), e.maxMeasure()));
            }
        }
        return closed;
    }

    /**
     * Advances existing episodes whose activation is false without GPS input, such as a rule requiring an active
     * trip after access ends. An activation that needs unavailable fields is unknown and leaves its episode alone.
     */
    public Result reconcile(String tenantCode, String assetId, Instant at, Map<String, Object> root,
            List<CompiledSymptom> symptoms) {
        List<CompiledSymptom> inactive = symptoms.stream()
                .filter(s -> store.find(tenantCode, assetId, s.definitionId()).isPresent())
                .filter(s -> {
                    RuleResult activation = s.activation().run(root);
                    return activation.ok() && Boolean.FALSE.equals(activation.value());
                }).toList();
        return evaluate(tenantCode, assetId, at, root, inactive);
    }

    /**
     * @param root the source object the rules read, keyed by the source's root name (e.g. {@code signal})
     */
    public Result evaluate(String tenantCode, String assetId, Instant at, Map<String, Object> root,
            List<CompiledSymptom> symptoms) {
        List<Transition> transitions = new ArrayList<>();
        List<RuleError> errors = new ArrayList<>();
        Map<String, List<CompiledSymptom>> bySource = new LinkedHashMap<>();
        symptoms.forEach(s -> bySource.computeIfAbsent(s.sourceKey(), k -> new ArrayList<>()).add(s));
        bySource.forEach((sourceKey, group) -> {
            Optional<Instant> last = store.watermark(tenantCode, assetId, sourceKey);
            if (last.isPresent() && !at.isAfter(last.get())) {
                return;
            }
            for (CompiledSymptom s : group) {
                try {
                    step(tenantCode, assetId, at, root, s).ifPresent(transitions::add);
                } catch (RuleFailure f) {
                    errors.add(new RuleError(s.definitionId(), s.version(), f.section, f.getMessage()));
                }
            }
            store.setWatermark(tenantCode, assetId, sourceKey, at);
        });
        return new Result(transitions, errors);
    }

    /**
     * A frame older than the watermark, for the event-driven symptoms only: each one whose activation holds and
     * that has no open case takes the frame as a normal step, so a buffered event opens its case. A step that
     * does not open the case is undone, so an older frame never seeds hold-time state; neither the watermark nor
     * any other episode moves, and an open case opens nothing new.
     */
    public Result evaluateLate(String tenantCode, String assetId, Instant at, Map<String, Object> root,
            List<CompiledSymptom> symptoms) {
        List<Transition> transitions = new ArrayList<>();
        List<RuleError> errors = new ArrayList<>();
        for (CompiledSymptom s : symptoms) {
            if (!s.eventDriven() || store.find(tenantCode, assetId, s.definitionId()).filter(Episode::open)
                    .isPresent()) {
                continue;
            }
            try {
                if (condition(s.activation(), root, "activation")) {
                    Optional<Episode> before = store.find(tenantCode, assetId, s.definitionId());
                    Optional<Transition> t = step(tenantCode, assetId, at, root, s)
                            .filter(x -> x.kind() == Kind.OPENED || x.kind() == Kind.HELD);
                    t.ifPresent(transitions::add);
                    if (t.filter(x -> x.kind() == Kind.OPENED).isEmpty()) {
                        before.ifPresentOrElse(e -> store.save(tenantCode, e),
                                () -> store.delete(tenantCode, assetId, s.definitionId()));
                    }
                }
            } catch (RuleFailure f) {
                errors.add(new RuleError(s.definitionId(), s.version(), f.section, f.getMessage()));
            }
        }
        return new Result(transitions, errors);
    }

    /** What one signal says about one symptom, before the lifecycle runs. */
    private record Reading(boolean active, double measure, int level, Instant candidateSince,
            Map<Integer, Instant> levelSince, Instant conditionSince, Instant normalSince) {
    }

    private Optional<Transition> step(String tenantCode, String assetId, Instant at, Map<String, Object> root,
            CompiledSymptom s) {
        Episode e = store.find(tenantCode, assetId, s.definitionId())
                .orElseGet(() -> Episode.start(s.definitionId(), s.version(), assetId));
        Reading r = read(s, e, root, at);
        boolean held = s.state() == SymptomState.ACTIVE
                && holds.held(tenantCode, assetId, s.definitionId(), e.openedAt());
        Step next = e.open() ? whileOpen(s, e, at, r, held) : whileClosed(s, e, at, r, held);
        if (next.episode().worthKeeping()) {
            store.save(tenantCode, next.episode());
        } else if (e.lastSignalAt() != null) {
            store.delete(tenantCode, assetId, s.definitionId());
        }
        return Optional.ofNullable(next.transition());
    }

    private static Reading read(CompiledSymptom s, Episode e, Map<String, Object> root, Instant at) {
        if (!condition(s.activation(), root, "activation")) {
            return new Reading(false, 0, 0, null, Map.of(), null, firstNonNull(e.normalSince(), at));
        }
        Instant candidateSince = firstNonNull(e.candidateSince(), at);
        double measure = measure(s, root);
        Map<Integer, Instant> previous = s.version().equals(e.version()) ? e.levelSince() : Map.of();
        LevelReading levels = levels(s, root, measure, candidateSince, previous, at);
        boolean active = levels.level() > 0;
        return new Reading(active, measure, levels.level(), candidateSince, levels.since(),
                active ? firstNonNull(e.conditionSince(), at) : null,
                active ? null : firstNonNull(e.normalSince(), at));
    }

    private record LevelReading(int level, Map<Integer, Instant> since) {
    }

    /** The highest level that holds; if none does, the level below the lowest one waiting for its hold time. */
    private static LevelReading levels(CompiledSymptom s, Map<String, Object> root, double measure,
            Instant candidateSince, Map<Integer, Instant> previous, Instant at) {
        Map<String, Object> vars = new LinkedHashMap<>(root);
        vars.put("measure", measure);
        Map<Integer, Instant> since = new HashMap<>();
        int reached = 0;
        int floor = 0;
        int below = 0;
        for (Map.Entry<Integer, PreparedRule> l : s.levels().entrySet()) {
            String section = "levels." + l.getKey();
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

    private record Step(Episode episode, Transition transition) {
    }

    /**
     * A closed episode's {@code level} is 0, or while a hold keeps its opening back the level it would have opened
     * at, so the evidence is recorded once per run.
     */
    private Step whileClosed(CompiledSymptom s, Episode e, Instant at, Reading r, boolean held) {
        if (r.active()
                && condition(s.open(), caseFields(r.conditionSince(), r.normalSince(), null, r.level(), at),
                        "lifecycle.open")) {
            if (held) {
                Episode kept = new Episode(s.definitionId(), s.version(), e.assetId(), null, r.conditionSince(),
                        r.normalSince(), Map.of(), at, null, r.level(), 0);
                Transition evidence = e.level() == 0
                        ? transition(Kind.HELD, s, e.assetId(), at, r.level(), 0, r.measure())
                        : null;
                return new Step(kept, evidence);
            }
            int initial = e.level() > 0 ? s.levels().keySet().iterator().next() : r.level();
            Episode opened = new Episode(s.definitionId(), s.version(), e.assetId(), r.candidateSince(),
                    r.conditionSince(), r.normalSince(), r.levelSince(), at, at, initial, r.measure());
            return new Step(opened, transition(Kind.OPENED, s, e.assetId(), at, initial, 0, r.measure()));
        }
        return new Step(new Episode(s.definitionId(), s.version(), e.assetId(), r.candidateSince(),
                r.conditionSince(), r.normalSince(), r.levelSince(), at, null, 0, 0), null);
    }

    private Step whileOpen(CompiledSymptom s, Episode e, Instant at, Reading r, boolean held) {
        // Down only while the condition still holds: a normal signal leaves the case at its level until it closes.
        // A held case stays where it is.
        int level;
        if (held) {
            level = e.level();
        } else {
            level = s.levelDown() && r.active() ? r.level() : Math.max(e.level(), r.level());
        }
        double max = r.active() ? Math.max(e.maxMeasure(), r.measure()) : e.maxMeasure();
        if (condition(s.close(), caseFields(r.conditionSince(), r.normalSince(), e.openedAt(), level, at),
                "lifecycle.close")) {
            // A condition that still holds starts a new run on the next signal.
            Episode closed = new Episode(s.definitionId(), s.version(), e.assetId(), null, null, r.normalSince(),
                    Map.of(), at, null, 0, 0);
            return new Step(closed, transition(Kind.CLOSED, s, e.assetId(), at, level, e.level(), max));
        }
        Map<Integer, Instant> since = new HashMap<>(r.levelSince());
        if (held) {
            since.replaceAll((key, value) -> at);
        }
        Episode kept = new Episode(s.definitionId(), s.version(), e.assetId(), held ? null : r.candidateSince(),
                r.conditionSince(), r.normalSince(), since, at, e.openedAt(), level, max);
        Transition changed = level != e.level()
                ? transition(Kind.LEVEL_CHANGED, s, e.assetId(), at, level, e.level(), r.measure())
                : null;
        return new Step(kept, changed);
    }

    private static Transition transition(Kind kind, CompiledSymptom s, String assetId, Instant at, int level,
            int previous, double measure) {
        return new Transition(kind, s.definitionId(), s.version(), s.state(), assetId, at, level, previous, measure);
    }

    /** The {@code case} object the lifecycle reads. */
    private static Map<String, Object> caseFields(Instant conditionSince, Instant normalSince, Instant openedAt,
            int level, Instant at) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("condition_s", seconds(conditionSince, at));
        fields.put("normal_s", normalSince == null ? NOT_NORMAL : seconds(normalSince, at));
        fields.put("age_h", seconds(openedAt, at) / 3600);
        fields.put("level", (double) level);
        fields.put("closed_by_operator", false);
        return Map.of("case", fields);
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
