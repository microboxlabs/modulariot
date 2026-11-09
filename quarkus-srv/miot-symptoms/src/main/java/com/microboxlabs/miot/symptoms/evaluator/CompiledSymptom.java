package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.PreparedRule;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleSchema;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleText;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.signal.GpsSignal;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * One published symptom version with its rules compiled once, ready to run on
 * every signal of its source.
 *
 * @param sourceKey the data source whose signals it reads
 * @param measure   null for a symptom whose levels do not read a measure
 * @param levels  the levels that apply, by ICU, lowest first
 * @param state     TEST runs in shadow, ACTIVE runs live; OFF versions are not compiled
 * @param close     reads the case and the signal
 * @param note      null, or the rule that writes a timeline entry on an open case without closing it
 * @param levelDown   an open case's level follows the measure down
 * @param opensOnEvents its activation, open, measure or levels read a device event ({@link #EVENT_FIELDS}), so a late
 *                  frame may still open its case
 * @param lifecycleOnEvents its close or note rule reads a device event, so a late frame may still close or note
 *                  its open case
 * @param reads     the field paths its rules read
 * @param speedLimitSource the limit read by a recognized speed-excess measure, or null
 */
public record CompiledSymptom(
        UUID definitionId,
        String version,
        SymptomState state,
        String sourceKey,
        PreparedRule activation,
        PreparedRule measure,
        Map<Integer, PreparedRule> levels,
        PreparedRule open,
        PreparedRule close,
        PreparedRule note,
        boolean levelDown,
        boolean opensOnEvents,
        boolean lifecycleOnEvents,
        Set<String> reads,
        String speedLimitSource) {

    /**
     * Device events: a device stores them while it cannot reach the network and delivers them late, often after
     * a newer fix, so a symptom that reads one is also run on frames older than the watermark. A path under one
     * of them counts too ({@code signal.frame.events} read by {@code exists}).
     */
    static final List<String> EVENT_FIELDS = List.of(GpsSignal.FrameEvent.FRAME_EVENTS,
            "signal.frame.sensors.panic_button", "signal.derived.power_disconnected", "signal.derived.jamming");

    /** Without a note rule; {@code eventDriven} as {@link #opensOnEvents}. */
    @SuppressWarnings("java:S107")
    public CompiledSymptom(UUID definitionId, String version, SymptomState state, String sourceKey,
            PreparedRule activation, PreparedRule measure, Map<Integer, PreparedRule> levels, PreparedRule open,
            PreparedRule close, boolean levelDown, boolean eventDriven) {
        this(definitionId, version, state, sourceKey, activation, measure, levels, open, close, null, levelDown,
                eventDriven, false, Set.of(), null);
    }

    /** Without the fields its rules read. */
    @SuppressWarnings("java:S107")
    public CompiledSymptom(UUID definitionId, String version, SymptomState state, String sourceKey,
            PreparedRule activation, PreparedRule measure, Map<Integer, PreparedRule> levels, PreparedRule open,
            PreparedRule close, PreparedRule note, boolean levelDown, boolean opensOnEvents,
            boolean lifecycleOnEvents) {
        this(definitionId, version, state, sourceKey, activation, measure, levels, open, close, note, levelDown,
                opensOnEvents, lifecycleOnEvents, Set.of(), null);
    }

    /** One of its rules reads the field, or a field under it. */
    public boolean reads(String path) {
        return reads.stream().anyMatch(p -> p.equals(path) || p.startsWith(path + "."));
    }

    /** Any of its rules reads a device event: a late frame still runs it. */
    public boolean eventDriven() {
        return opensOnEvents || lifecycleOnEvents;
    }

    /** The same rules under another state, as when the symptom is switched between test and active. */
    public CompiledSymptom withState(SymptomState next) {
        return new CompiledSymptom(definitionId, version, next, sourceKey, activation, measure, levels, open,
                close, note, levelDown, opensOnEvents, lifecycleOnEvents, reads, speedLimitSource);
    }

    public static CompiledSymptom compile(UUID definitionId, String version, SymptomState state, SymptomSpec spec,
            DataSource source) {
        if (state == SymptomState.OFF) {
            throw new IllegalArgumentException("an OFF symptom is not evaluated");
        }
        if (spec.lifecycle() == null) {
            throw new IllegalArgumentException("the version has no lifecycle");
        }
        RuleSchema schema = RuleSchema.of(source);
        RuleSchema levelSchema = schema.withExtras(RuleSchema.LEVEL_VARIABLES);
        RuleSchema lifecycle = RuleSchema.lifecycle(source);
        Map<Integer, PreparedRule> levels = new TreeMap<>();
        List<String> opening = new ArrayList<>();
        opening.add(spec.activation());
        opening.add(spec.lifecycle().open());
        for (Level l : spec.levels() == null ? List.<Level>of() : spec.levels()) {
            if (l.applies()) {
                levels.put(l.icu(), RuleLanguage.prepare(levelSchema, l.when()));
                opening.add(l.when());
            }
        }
        PreparedRule measure = spec.measure() == null || spec.measure().expression() == null ? null
                : RuleLanguage.prepare(schema, spec.measure().expression());
        if (measure != null) {
            opening.add(spec.measure().expression());
        }
        String note = spec.lifecycle().note();
        Set<String> reads = new LinkedHashSet<>();
        opening.forEach(r -> reads.addAll(paths(r)));
        reads.addAll(paths(spec.lifecycle().close()));
        reads.addAll(paths(note));
        return new CompiledSymptom(definitionId, version, state, source.key(),
                RuleLanguage.prepare(schema, spec.activation()),
                measure, Collections.unmodifiableMap(levels),
                RuleLanguage.prepare(lifecycle, spec.lifecycle().open()),
                RuleLanguage.prepare(lifecycle, spec.lifecycle().close()),
                note == null ? null : RuleLanguage.prepare(lifecycle, note), spec.lifecycle().levelDown(),
                opening.stream().anyMatch(CompiledSymptom::readsEvents),
                readsEvents(spec.lifecycle().close()) || readsEvents(note), Set.copyOf(reads),
                EngineCase.SpeedLimit.source(spec.measure() == null ? null : spec.measure().expression()));
    }

    private static Set<String> paths(String rule) {
        return rule == null ? Set.of() : RuleText.fieldPaths(rule);
    }

    /** Whether the rule reads a device event field, optional selectors ({@code .?}) included. */
    static boolean readsEvents(String rule) {
        return rule != null && RuleText.fieldPaths(rule).stream().anyMatch(CompiledSymptom::isEventField);
    }

    private static boolean isEventField(String path) {
        return EVENT_FIELDS.stream().anyMatch(f -> path.equals(f) || path.startsWith(f + "."));
    }
}
