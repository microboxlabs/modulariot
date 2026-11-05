package com.microboxlabs.miot.symptoms.evaluator;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.cases.IgnoreHold;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector;
import com.microboxlabs.miot.symptoms.signal.GpsSignal;
import com.microboxlabs.miot.symptoms.signal.SignalFields;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.reactive.messaging.pulsar.PulsarIncomingMessageMetadata;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.jboss.logging.Logger;

/**
 * Runs the published symptom versions on each GPS signal ({@code gps-signals-in},
 * {@code miot.gps.signal@1}) for every organization the vehicle belongs to,
 * keeps the episodes in Redis (in memory when no Redis URL is set), records
 * the case changes in {@code miot_symptoms.signal_transitions}, publishes each new
 * one as a {@code symptom.case.*} event ({@link SymptomEvents}) and keeps
 * recent signals for rule previews ({@link SignalSamples}). A signal older than
 * the organization's watermark is counted ({@code miot.symptoms.evaluator.late})
 * and handed to {@link LateFrames}; the symptoms do not run on it. Every signal
 * also goes to the {@link LostSignalDetector}. On wherever
 * the symptoms Pulsar is wired ({@code miot.symptoms.evaluator.enabled}).
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class EvaluatorStream {

    private static final Logger LOG = Logger.getLogger(EvaluatorStream.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    static final String SOURCE = "gps_signal";
    private static final String FRAME = "frame";
    private static final Duration VERSIONS_TTL = Duration.ofSeconds(30);
    /** Client ids are 8 characters before any suffix; the tag keeps only those. */
    private static final int SENDER_TAG = 8;

    private final boolean enabled;
    private final EvaluatorCatalog catalog;
    private final TransitionLog transitionLog;
    private final MeterRegistry meters;
    private final Clock clock;
    private final EpisodeRepository episodes;
    private final SignalSamples samples;
    private final SymptomEvents events;
    private final LateFrames lateFrames;
    private final LostSignalDetector lostSignal;
    private final Holds holds;
    private final Map<String, Cached> versions = new ConcurrentHashMap<>();

    private record Cached(Instant at, List<CompiledSymptom> symptoms) {
    }

    @Inject
    EvaluatorStream(@ConfigProperty(name = "miot.symptoms.evaluator.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.evaluator.episode-ttl", defaultValue = "P7D") Duration ttl,
            EvaluatorRedis redis, SignalSamples samples, EvaluatorCatalog catalog, TransitionLog transitionLog,
            MeterRegistry meters, SymptomEvents events, Instance<LateFrames> lateFrames, LostSignalDetector lostSignal,
            Holds holds) {
        this(enabled, catalog, new Sinks(transitionLog, events, meters), Clock.systemUTC(),
                // Also when not consuming: closing a case drops its episode in the Redis the consumers use.
                redis.api().<EpisodeRepository>map(api -> new RedisEpisodes(api, ttl))
                        .orElseGet(InMemoryEpisodeRepository::new),
                samples, lateFrames.isResolvable() ? lateFrames.get() : LateFrames.NONE, lostSignal, holds);
        if (enabled) {
            LOG.infof("Symptom evaluator: on, episodes in %s",
                    episodes instanceof RedisEpisodes ? "Redis" : "memory");
        }
    }

    /** Where the evaluator writes: the transition log, the case events and the metrics. */
    record Sinks(TransitionLog transitionLog, SymptomEvents events, MeterRegistry meters) {
    }

    EvaluatorStream(boolean enabled, EvaluatorCatalog catalog, Sinks sinks, Clock clock, EpisodeRepository episodes,
            SignalSamples samples) {
        this(enabled, catalog, sinks, clock, episodes, samples, LateFrames.NONE, LostSignalDetector.off());
    }

    @SuppressWarnings("java:S107") // The collaborators above, plus the two hooks, for tests.
    EvaluatorStream(boolean enabled, EvaluatorCatalog catalog, Sinks sinks, Clock clock, EpisodeRepository episodes,
            SignalSamples samples, LateFrames lateFrames, LostSignalDetector lostSignal) {
        this(enabled, catalog, sinks, clock, episodes, samples, lateFrames, lostSignal, Holds.NONE);
    }

    @SuppressWarnings("java:S107") // As above, with the holds the evaluator reads.
    EvaluatorStream(boolean enabled, EvaluatorCatalog catalog, Sinks sinks, Clock clock, EpisodeRepository episodes,
            SignalSamples samples, LateFrames lateFrames, LostSignalDetector lostSignal, Holds holds) {
        this.holds = holds;
        this.lateFrames = lateFrames;
        this.lostSignal = lostSignal;
        this.enabled = enabled;
        this.catalog = catalog;
        this.transitionLog = sinks.transitionLog();
        this.events = sinks.events();
        this.meters = sinks.meters();
        this.clock = clock;
        this.episodes = episodes;
        this.samples = samples;
    }

    @Incoming("gps-signals-in")
    @Blocking
    public CompletionStage<Void> onSignal(Message<byte[]> in) {
        try {
            evaluate(new String(in.getPayload(), StandardCharsets.UTF_8), arrivedAt(in));
        } catch (IllegalArgumentException e) {
            meters.counter("miot.symptoms.evaluator.failed").increment();
            LOG.warnf("Symptom evaluator: signal skipped (%s)", e.getClass().getSimpleName());
        } catch (RuntimeException e) {
            // Redis, the catalog or the transition log failed: redelivered, and organizations already
            // evaluated reject the replay by their watermark.
            meters.counter("miot.symptoms.evaluator.retried").increment();
            LOG.warnf("Symptom evaluator: signal retried (%s)", e.getClass().getSimpleName());
            return in.nack(e);
        }
        return in.ack();
    }

    /** When the signal builder published the signal, or now when the message does not say. */
    private Instant arrivedAt(Message<byte[]> in) {
        return in.getMetadata(PulsarIncomingMessageMetadata.class).map(PulsarIncomingMessageMetadata::getPublishTime)
                .filter(ms -> ms > 0).map(Instant::ofEpochMilli).orElseGet(clock::instant);
    }

    /**
     * When the frame reached the platform: the gateway's time the signal carries ({@code received_at}), so a
     * backlog before the signal builder does not read as the device's delay; else when the builder published it.
     */
    static Instant arrival(Map<String, Object> signal, Instant published) {
        if (signal.get("received_at") instanceof String received) {
            try {
                return Instant.parse(received);
            } catch (DateTimeParseException e) {
                return published;
            }
        }
        return published;
    }

    int evaluate(String json) {
        return evaluate(json, clock.instant());
    }

    /** Evaluates one signal for every organization it belongs to; returns the transitions recorded. */
    int evaluate(String json, Instant arrivedAt) {
        if (!enabled) {
            return 0;
        }
        Map<String, Object> signal;
        try {
            signal = JSON.readValue(json, new TypeReference<>() {
            });
        } catch (Exception e) {
            throw new IllegalArgumentException("not a signal", e);
        }
        Object asset = signal.get("asset_id");
        Object at = signal.get("at");
        if (!(asset instanceof String assetId) || !(at instanceof String time)
                || !(signal.get("clients") instanceof List<?> clients)) {
            return 0;
        }
        Instant instant;
        try {
            instant = Instant.parse(time);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("not a signal time", e);
        }
        // Before the organizations: a failing catalog or log must not keep the frame out of the profiles.
        lostSignal.frame(assetId, instant, arrival(signal, arrivedAt), signal);
        int recorded = 0;
        boolean late = false;
        for (Object client : clients) {
            if (client instanceof String tenant) {
                Evaluated e = evaluate(tenant, assetId, instant, forTenant(signal, tenant), false);
                recorded += e.transitions();
                late |= e.late();
            }
        }
        for (String tenant : episodes.tenantsWithEpisodes(assetId)) {
            if (!clients.contains(tenant)) {
                recorded += evaluate(tenant, assetId, instant,
                        Map.of("asset_id", assetId, "at", time, "trip", NO_TRIP,
                                FRAME, Map.of("events", List.of())), true).transitions();
            }
        }
        if (late) {
            meters.counter("miot.symptoms.evaluator.late", "sender", senderTag(signal.get("sender"))).increment();
        }
        return recorded;
    }

    static String senderTag(Object sender) {
        if (!(sender instanceof String s) || s.isBlank()) {
            return "none";
        }
        return s.length() > SENDER_TAG ? s.substring(0, SENDER_TAG) : s;
    }

    /** @param late the signal was older than the organization's watermark, so its symptoms did not run */
    private record Evaluated(int transitions, boolean late) {
    }

    private static final Map<String, Object> NO_TRIP = Map.of("active", false, "double_driver", false);

    /**
     * The signal as the organization's rules read it: its own trip as {@code trip} and its own zones as
     * {@code geo}, none of the others, and the frame's events always a list ({@link GpsSignal.FrameEvent}).
     * An organization without zones gets no {@code geo}.
     */
    static Map<String, Object> forTenant(Map<String, Object> signal, String tenant) {
        Map<String, Object> out = new LinkedHashMap<>(GpsSignal.FrameEvent.withEvents(signal));
        Object trips = out.remove("trips");
        Object trip = trips instanceof Map<?, ?> byClient ? byClient.get(tenant) : null;
        out.put("trip", trip != null ? trip : NO_TRIP);
        Object geos = out.remove("geos");
        out.remove("geo");
        Object geo = geos instanceof Map<?, ?> byClient ? byClient.get(tenant) : null;
        if (geo != null) {
            out.put("geo", geo);
        }
        return out;
    }

    private Evaluated evaluate(String tenant, String assetId, Instant at, Map<String, Object> signal,
            boolean reconcile) {
        if (!reconcile) {
            samples.keep(tenant, signal);
        }
        List<CompiledSymptom> symptoms = symptoms(tenant);
        if (symptoms.isEmpty() && !reconcile) {
            return new Evaluated(0, false);
        }
        AssetEpisodes state = episodes.load(tenant, assetId);
        if (symptoms.isEmpty()) {
            episodes.save(state);
            return new Evaluated(0, false);
        }
        Instant newest = state.watermark(tenant, assetId, SOURCE).orElse(null);
        boolean late = newest != null && at.isBefore(newest);
        if (late && reconcile) {
            return new Evaluated(0, false);
        }
        if (late && !lateRuns(tenant, assetId, at, newest, signal, symptoms)) {
            return new Evaluated(0, true);
        }
        // A late frame runs only the event-driven symptoms, without moving the watermark (a buffered panic or
        // sabotage event still opens its case); the others keep skipping it.
        SignalEvaluator evaluator = new SignalEvaluator(state, holds);
        Map<String, Object> root = Map.of(SignalFields.ROOT, signal);
        SignalEvaluator.Result result;
        if (reconcile) {
            result = evaluator.reconcile(tenant, assetId, at, root, symptoms);
        } else {
            result = late ? evaluator.evaluateLate(tenant, assetId, at, root, symptoms)
                    : evaluator.evaluate(tenant, assetId, at, root, symptoms);
        }
        writeResult(tenant, assetId, signal, state, result, late);
        return new Evaluated(result.transitions().size(), late);
    }

    /** Hands a late frame to the late hook; true when an event-driven symptom still has to run on it. */
    private boolean lateRuns(String tenant, String assetId, Instant at, Instant newest, Map<String, Object> signal,
            List<CompiledSymptom> symptoms) {
        try {
            lateFrames.late(tenant, assetId, at, newest, signal);
        } catch (RuntimeException e) {
            // A failed hook is not worth a redelivery.
            meters.counter("miot.symptoms.evaluator.late_hook_failed").increment();
        }
        return symptoms.stream().anyMatch(CompiledSymptom::eventDriven);
    }

    /** Writes the result: transitions first, since a failed episode write replays the signal and the log skips
     * what it already holds; then the episodes and the counters. */
    private void writeResult(String tenant, String assetId, Map<String, Object> signal, AssetEpisodes state,
            SignalEvaluator.Result result, boolean late) {
        if (!result.transitions().isEmpty()) {
            TransitionLog.Place place = place(signal);
            // Only the changes new to the log: a replayed signal publishes nothing twice.
            List<TransitionLog.Recorded> recorded = transitionLog.append(tenant, result.transitions(), place);
            events.transitions(tenant, recorded.stream()
                    .filter(r -> !holds.held(tenant, assetId, r.transition().definitionId(), Instant.EPOCH))
                    .toList(), place);
            if (late) {
                // A late opening the log already holds is a replay of a case that may be closed since: it keeps no
                // episode, or that episode would block the next real event.
                result.transitions().stream()
                        .filter(t -> t.kind() == Transition.Kind.OPENED)
                        .filter(t -> recorded.stream().noneMatch(r -> r.transition().equals(t)))
                        .forEach(t -> state.delete(tenant, assetId, t.definitionId()));
            }
        }
        episodes.save(state);
        result.transitions().forEach(t -> meters.counter("miot.symptoms.evaluator.transitions",
                "kind", t.kind().name(), "state", t.state().name()).increment());
        if (!result.errors().isEmpty()) {
            meters.counter("miot.symptoms.evaluator.rule_errors").increment(result.errors().size());
        }
    }

    /**
     * An operator closed the symptom's case for the vehicle: its episode is dropped, so the next signal that
     * meets the condition opens a new case.
     */
    public void forget(String tenant, String assetId, java.util.UUID definitionId) {
        forget(tenant, assetId, definitionId, null);
    }

    /**
     * As {@link #forget(String, String, java.util.UUID)}, and the episode keeps the case's trip, so the open rule
     * reads {@code case.closed_on_trip} true while the vehicle stays on that trip.
     */
    public void forget(String tenant, String assetId, java.util.UUID definitionId, String tripId) {
        // Both consumers share the Redis episode hash. Clear the detector before saving the close marker.
        lostSignal.forget(tenant, assetId, definitionId);
        if (tripId == null) {
            episodes.forget(tenant, assetId, definitionId);
        } else {
            AssetEpisodes state = episodes.load(tenant, assetId);
            state.save(tenant, Episode.closedOnTrip(definitionId, assetId, tripId));
            episodes.save(state);
        }
    }

    /** Rechecks the latest condition evidence before releasing a hold, then restarts its level timers. */
    public void finishHold(IgnoreHold h) {
        AssetEpisodes state = episodes.load(h.tenantCode(), h.assetId());
        List<CompiledSymptom> covered = Stream.concat(catalog.forSource(h.tenantCode(), SOURCE).symptoms().stream(),
                catalog.forSource(h.tenantCode(), "trip_check").symptoms().stream())
                .filter(s -> state.find(h.tenantCode(), h.assetId(), s.definitionId())
                        .map(e -> h.covers(h.assetId(), s.definitionId(), e.openedAt())).orElse(false))
                .toList();
        List<Transition> closed = new SignalEvaluator(state).finishHold(h.tenantCode(), h.assetId(), clock.instant(),
                covered);
        if (!closed.isEmpty()) {
            transitionLog.append(h.tenantCode(), closed, new TransitionLog.Place(h.tripId(), null, null, null, null));
        }
        episodes.save(state);
    }

    /** The trip, position and driver of the signal, as far as it has them. */
    static TransitionLog.Place place(Map<String, Object> signal) {
        return new TransitionLog.Place(text(path(signal, "trip", "id")),
                number(path(signal, FRAME, "gps", "latitude")), number(path(signal, FRAME, "gps", "longitude")),
                number(path(signal, FRAME, "gps", "speed")), text(path(signal, "trip", "driver", "id")));
    }

    private static String text(Object value) {
        return value instanceof String s ? s : null;
    }

    private static Object path(Map<String, Object> root, String... keys) {
        Object node = root;
        for (String k : keys) {
            node = node instanceof Map<?, ?> m ? m.get(k) : null;
        }
        return node;
    }

    private static Double number(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }

    private List<CompiledSymptom> symptoms(String tenant) {
        Instant now = clock.instant();
        Cached c = versions.get(tenant);
        if (c == null || c.at().plus(VERSIONS_TTL).isBefore(now)) {
            EvaluatorCatalog.Versions v = catalog.forSource(tenant, SOURCE);
            v.skipped().forEach(s -> LOG.debugf("Symptom evaluator: %s %s skipped: %s", s.definitionId(),
                    s.version(), s.reason()));
            c = new Cached(now, v.symptoms());
            versions.put(tenant, c);
        }
        return c.symptoms();
    }
}
