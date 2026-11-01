package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.AssetEpisodes;
import com.microboxlabs.miot.symptoms.evaluator.CompiledSymptom;
import com.microboxlabs.miot.symptoms.evaluator.Episode;
import com.microboxlabs.miot.symptoms.evaluator.EpisodeRepository;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorCatalog;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.CheckState.OpenCase;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.TripCheck;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Runs the organization's {@code trip_check} versions on a lost vehicle's check, with the evaluator's episodes,
 * transition log and case events, and keeps the id of each case they open. When the signal returns, each open
 * case gets a {@code symptom.case.signal_returned} event and, for an ACTIVE case, an audit entry; the case stays
 * open for the operator.
 */
public class TripChecks {

    static final String SOURCE = TripCheck.KEY;
    static final String SIGNAL_RETURNED = "case.signal_returned";
    private static final String BACKFILL = "backfill";
    private static final Duration VERSIONS_TTL = Duration.ofSeconds(30);

    private final EvaluatorCatalog catalog;
    private final EpisodeRepository episodes;
    private final TransitionLog log;
    private final SymptomEvents events;
    private final AuditService audit;
    private final MeterRegistry meters;
    private final Map<String, Cached> versions = new ConcurrentHashMap<>();

    private record Cached(Instant at, List<CompiledSymptom> symptoms) {
    }

    /** How the signal came back. */
    public record Return(Instant at, boolean backfill) {
    }

    public TripChecks(EvaluatorCatalog catalog, EpisodeRepository episodes, TransitionLog log, SymptomEvents events,
            AuditService audit, MeterRegistry meters) {
        this.catalog = catalog;
        this.episodes = episodes;
        this.log = log;
        this.events = events;
        this.audit = audit;
        this.meters = meters;
    }

    /**
     * Evaluates the check of every organization the vehicle is on a trip with.
     *
     * @param back null while the vehicle is silent
     * @return the cases open after it, by {@code tenant/symptom id}
     */
    public Map<String, OpenCase> check(String assetId, LossStore.Vehicle v, Map<String, OpenCase> cases,
            Instant now, Return back) {
        Map<String, OpenCase> open = new HashMap<>(cases);
        v.watch().trips().forEach((tenant, trip) -> {
            Map<String, Object> check = document(v, trip, now, back);
            evaluate(tenant, assetId, now, check, trip, v.profile().last(), open);
        });
        if (back != null) {
            returned(assetId, v, open, back);
        }
        return open;
    }

    /**
     * Tells every case the checks opened and that is still open that the signal came back, whether or not its
     * organization's trip or symptom still runs: the case keeps the version and state it was opened with.
     */
    private void returned(String assetId, LossStore.Vehicle v, Map<String, OpenCase> open, Return back) {
        Map<String, AssetEpisodes> byTenant = new HashMap<>();
        for (Map.Entry<String, OpenCase> entry : List.copyOf(open.entrySet())) {
            int slash = entry.getKey().indexOf('/');
            String tenant = entry.getKey().substring(0, slash);
            UUID definitionId = UUID.fromString(entry.getKey().substring(slash + 1));
            Episode e = byTenant.computeIfAbsent(tenant, t -> episodes.load(t, assetId))
                    .find(tenant, assetId, definitionId).orElse(null);
            if (e == null || !e.open()) {
                open.remove(entry.getKey());
                continue;
            }
            Map<String, Object> trip = v.watch().trips().getOrDefault(tenant, Map.of());
            returned(tenant, assetId, definitionId, entry.getValue(), e, place(trip, v.profile().last()), back);
        }
    }

    /** The check as the organization's rules read it, under {@code check}. */
    static Map<String, Object> document(LossStore.Vehicle v, Map<String, Object> trip, Instant now, Return back) {
        VehicleProfile p = v.profile();
        double silence = Math.max(0, (now.toEpochMilli() - p.at().toEpochMilli()) / 1000.0);
        double expected = Math.max(1.0, (double) v.watch().expectedS());
        Map<String, Object> loss = new LinkedHashMap<>();
        loss.put("silence_s", silence);
        loss.put("expected_s", expected);
        loss.put("ratio", silence / expected);
        loss.put("last", last(p.last()));
        if (v.watch().sender() != null) {
            loss.put("sender", v.watch().sender());
        }
        loss.put("returned", back != null);
        loss.put(BACKFILL, back != null && back.backfill());
        Map<String, Object> check = new LinkedHashMap<>();
        check.put("signal_lost_minutes", silence / 60);
        check.put("trip", trip);
        check.put("loss", loss);
        return check;
    }

    private static Map<String, Object> last(VehicleProfile.Last last) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (last == null) {
            return out;
        }
        out.put("at", last.at().toString());
        putIfSet(out, "lat", last.latitude());
        putIfSet(out, "lon", last.longitude());
        putIfSet(out, "speed", last.speed());
        putIfSet(out, "engine", last.engine());
        return out;
    }

    private static void putIfSet(Map<String, Object> m, String k, Object v) {
        if (v != null) {
            m.put(k, v);
        }
    }

    private void evaluate(String tenant, String assetId, Instant now, Map<String, Object> check,
            Map<String, Object> trip, VehicleProfile.Last last, Map<String, OpenCase> open) {
        List<CompiledSymptom> symptoms = symptoms(tenant, now);
        if (symptoms.isEmpty()) {
            return;
        }
        AssetEpisodes state = episodes.load(tenant, assetId);
        SignalEvaluator.Result result = new SignalEvaluator(state)
                .evaluate(tenant, assetId, now, Map.of(TripCheck.ROOT, check), symptoms);
        TransitionLog.Place place = place(trip, last);
        if (!result.transitions().isEmpty()) {
            List<TransitionLog.Recorded> recorded = log.append(tenant, result.transitions(), place);
            recorded.stream().filter(r -> r.transition().kind() == Transition.Kind.OPENED)
                    .forEach(r -> open.put(key(tenant, r.transition().definitionId()),
                            new OpenCase(r.caseId(), r.transition().version(), r.transition().state())));
            events.transitions(tenant, recorded, place);
        }
        episodes.save(state);
        result.transitions().forEach(t -> meters.counter("miot.symptoms.evaluator.transitions",
                "kind", t.kind().name(), "state", t.state().name()).increment());
        if (!result.errors().isEmpty()) {
            meters.counter("miot.symptoms.evaluator.rule_errors").increment(result.errors().size());
        }
        for (CompiledSymptom s : symptoms) {
            Episode e = state.find(tenant, assetId, s.definitionId()).orElse(null);
            if (e == null || !e.open()) {
                open.remove(key(tenant, s.definitionId()));
            }
        }
    }

    private void returned(String tenant, String assetId, UUID definitionId, OpenCase c, Episode e,
            TransitionLog.Place place, Return back) {
        long caseId = c.id();
        events.signalReturned(tenant, caseId, definitionId, c.version(), c.state(), e.level(), assetId, place,
                back.at(), back.backfill());
        if (c.state() == SymptomState.ACTIVE) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("returnedAt", back.at().toString());
            details.put(BACKFILL, back.backfill());
            audit.log(tenant, "lost-signal-detector", SIGNAL_RETURNED, "symptom_case", String.valueOf(-caseId),
                    -caseId, details);
        }
        meters.counter("miot.symptoms.lost_signal.returned_facts", BACKFILL, String.valueOf(back.backfill()))
                .increment();
    }

    static String key(String tenant, UUID definitionId) {
        return tenant + "/" + definitionId;
    }

    @SuppressWarnings("unchecked")
    static TransitionLog.Place place(Map<String, Object> trip, VehicleProfile.Last last) {
        Object driver = trip.get("driver") instanceof Map<?, ?> d ? ((Map<String, Object>) d).get("id") : null;
        return new TransitionLog.Place(trip.get("id") instanceof String id ? id : null,
                last == null ? null : last.latitude(), last == null ? null : last.longitude(),
                last == null ? null : last.speed(), driver instanceof String s ? s : null);
    }

    /** Drops the vehicle's episode of the symptom, as when an operator closes its case. */
    public void forget(String tenant, String assetId, UUID definitionId) {
        episodes.forget(tenant, assetId, definitionId);
    }

    private List<CompiledSymptom> symptoms(String tenant, Instant now) {
        Cached c = versions.get(tenant);
        if (c == null || c.at().plus(VERSIONS_TTL).isBefore(now)) {
            c = new Cached(now, catalog.forSource(tenant, SOURCE).symptoms());
            versions.put(tenant, c);
        }
        return c.symptoms();
    }
}
