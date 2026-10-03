package com.microboxlabs.miot.symptoms.evaluator;

import static com.microboxlabs.miot.symptoms.evaluator.Episode.seconds;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.PreparedRule;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleResult;
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
 * <li>{@code sostenido_s} is how long the measure has met that level's
 * threshold, counted from the first signal where the level's rule would hold
 * with all the time in the world. While a level waits for its hold time, the
 * case is at the applying level below it.</li>
 * <li>The condition holds while a candidate reaches a level.
 * {@code caso.condicion_s} counts from the first such signal,
 * {@code caso.normal_s} from the first signal after it stopped. The lifecycle
 * opens and closes the case.</li>
 * <li>Per vehicle and symptom: a signal not newer than the last one seen is
 * ignored; a case's level only rises; after a case closes, a condition that
 * still holds starts a new run. An episode with nothing running is not
 * kept.</li>
 * </ul>
 */
public class SignalEvaluator {

    /** {@code sostenido_s} for asking whether a level's rule could hold at all. */
    private static final double FOREVER = 1e9;

    private final EpisodeStore store;

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
        this.store = store;
    }

    /**
     * @param root the source object the rules read, keyed by the source's root name (e.g. {@code signal})
     */
    public Result evaluate(String tenantCode, String assetId, Instant at, Map<String, Object> root,
            List<CompiledSymptom> symptoms) {
        List<Transition> transitions = new ArrayList<>();
        List<RuleError> errors = new ArrayList<>();
        for (CompiledSymptom s : symptoms) {
            try {
                step(tenantCode, assetId, at, root, s).ifPresent(transitions::add);
            } catch (RuleFailure f) {
                errors.add(new RuleError(s.definitionId(), s.version(), f.section, f.getMessage()));
            }
        }
        return new Result(transitions, errors);
    }

    /** What one signal says about one symptom, before the lifecycle runs. */
    private record Reading(boolean active, double measure, int level, Map<Integer, Instant> levelSince,
            Instant conditionSince, Instant normalSince) {
    }

    private Optional<Transition> step(String tenantCode, String assetId, Instant at, Map<String, Object> root,
            CompiledSymptom s) {
        Episode e = store.find(tenantCode, assetId, s.definitionId())
                .orElseGet(() -> Episode.start(s.definitionId(), s.version(), assetId));
        if (e.lastSignalAt() != null && !at.isAfter(e.lastSignalAt())) {
            return Optional.empty();
        }
        Reading r = read(s, e, root, at);
        Step next = e.open() ? whileOpen(s, e, at, r) : whileClosed(s, e, at, r);
        if (next.episode().worthKeeping()) {
            store.save(tenantCode, next.episode());
        } else if (e.lastSignalAt() != null) {
            store.delete(tenantCode, assetId, s.definitionId());
        }
        return Optional.ofNullable(next.transition());
    }

    private static Reading read(CompiledSymptom s, Episode e, Map<String, Object> root, Instant at) {
        if (!condition(s.activation(), root, "activation")) {
            return new Reading(false, 0, 0, Map.of(), null, firstNonNull(e.normalSince(), at));
        }
        double measure = measure(s, root);
        Map<String, Object> vars = new LinkedHashMap<>(root);
        vars.put("medida", measure);
        Map<Integer, Instant> since = new HashMap<>();
        int reached = 0;
        int floor = 0;
        int below = 0;
        for (Map.Entry<Integer, PreparedRule> l : s.levels().entrySet()) {
            String section = "levels." + l.getKey();
            vars.put("sostenido_s", FOREVER);
            if (condition(l.getValue(), vars, section)) {
                Instant start = e.levelSince().getOrDefault(l.getKey(), at);
                since.put(l.getKey(), start);
                vars.put("sostenido_s", seconds(start, at));
                if (condition(l.getValue(), vars, section)) {
                    reached = l.getKey();
                } else {
                    floor = Math.max(floor, below);
                }
            }
            below = l.getKey();
        }
        int level = Math.max(reached, floor);
        boolean active = level > 0;
        return new Reading(active, measure, level, since, active ? firstNonNull(e.conditionSince(), at) : null,
                active ? null : firstNonNull(e.normalSince(), at));
    }

    private record Step(Episode episode, Transition transition) {
    }

    private Step whileClosed(CompiledSymptom s, Episode e, Instant at, Reading r) {
        if (r.active()
                && condition(s.open(), caso(r.conditionSince(), r.normalSince(), null, r.level(), at),
                        "lifecycle.open")) {
            Episode opened = new Episode(s.definitionId(), s.version(), e.assetId(), r.conditionSince(),
                    r.normalSince(), r.levelSince(), at, at, r.level(), r.measure());
            return new Step(opened, transition(Kind.OPENED, s, e.assetId(), at, r.level(), 0, r.measure()));
        }
        return new Step(new Episode(s.definitionId(), s.version(), e.assetId(), r.conditionSince(),
                r.normalSince(), r.levelSince(), at, null, 0, 0), null);
    }

    private Step whileOpen(CompiledSymptom s, Episode e, Instant at, Reading r) {
        int level = Math.max(e.level(), r.level());
        double max = r.active() ? Math.max(e.maxMeasure(), r.measure()) : e.maxMeasure();
        if (condition(s.close(), caso(r.conditionSince(), r.normalSince(), e.openedAt(), level, at),
                "lifecycle.close")) {
            // A condition that still holds starts a new run on the next signal.
            Episode closed = new Episode(s.definitionId(), s.version(), e.assetId(), null, r.normalSince(), Map.of(),
                    at, null, 0, 0);
            return new Step(closed, transition(Kind.CLOSED, s, e.assetId(), at, level, level, max));
        }
        Episode kept = new Episode(s.definitionId(), s.version(), e.assetId(), r.conditionSince(), r.normalSince(),
                r.levelSince(), at, e.openedAt(), level, max);
        Transition raised = level > e.level()
                ? transition(Kind.LEVEL_CHANGED, s, e.assetId(), at, level, e.level(), r.measure())
                : null;
        return new Step(kept, raised);
    }

    private static Transition transition(Kind kind, CompiledSymptom s, String assetId, Instant at, int level,
            int previous, double measure) {
        return new Transition(kind, s.definitionId(), s.version(), s.state(), assetId, at, level, previous, measure);
    }

    /** The {@code caso} object the lifecycle reads. */
    private static Map<String, Object> caso(Instant conditionSince, Instant normalSince, Instant openedAt, int level,
            Instant at) {
        Map<String, Object> caso = new LinkedHashMap<>();
        caso.put("condicion_s", seconds(conditionSince, at));
        caso.put("normal_s", seconds(normalSince, at));
        caso.put("edad_h", seconds(openedAt, at) / 3600);
        caso.put("nivel", (double) level);
        caso.put("cerrado_por_operador", false);
        return Map.of("caso", caso);
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
