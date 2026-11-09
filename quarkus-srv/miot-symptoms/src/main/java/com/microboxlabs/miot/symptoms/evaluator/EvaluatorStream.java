package com.microboxlabs.miot.symptoms.evaluator;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.StaleCase;
import com.microboxlabs.miot.symptoms.cases.IgnoreHold;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.duty.DutyChecks;
import com.microboxlabs.miot.symptoms.duty.DutyStore;
import com.microboxlabs.miot.symptoms.duty.InMemoryDutyStore;
import com.microboxlabs.miot.symptoms.duty.RedisDutyStore;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector;
import com.microboxlabs.miot.symptoms.signal.GpsSignal;
import com.microboxlabs.miot.symptoms.signal.SignalFields;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.signal.TripCheck;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
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
 * also goes to the {@link LostSignalDetector}. A signal of device events only
 * ({@value GpsSignal#EVENTS_SCHEMA_ID}) runs only the symptoms that read device
 * events, as a late frame does, and does not reach the detector. Each frame of
 * an organization with {@code trip_check} symptoms that read the duty counters
 * also goes through its duty tracker, and those symptoms run on the frame's
 * check ({@link DutyChecks}). On with {@code miot.symptoms.evaluator.enabled}.
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
    private final DutyChecks duty;
    private final VehicleReads reads;
    private final Map<String, Cached> versions = new ConcurrentHashMap<>();
    private final Map<String, Cached> dutyVersions = new ConcurrentHashMap<>();

    private record Cached(Instant at, List<CompiledSymptom> symptoms) {
    }

    @Inject
    EvaluatorStream(@ConfigProperty(name = "miot.symptoms.evaluator.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.evaluator.episode-ttl", defaultValue = "P7D") Duration ttl,
            EvaluatorRedis redis, SignalSamples samples, EvaluatorCatalog catalog, TransitionLog transitionLog,
            MeterRegistry meters, SymptomEvents events, Instance<LateFrames> lateFrames, LostSignalDetector lostSignal,
            Holds holds) {
        this(enabled, catalog, new Sinks(transitionLog, events, meters), Clock.systemUTC(), Stores.of(redis, ttl),
                samples, lateFrames.isResolvable() ? lateFrames.get() : LateFrames.NONE, lostSignal, holds);
        if (enabled) {
            LOG.infof("Symptom evaluator: on, episodes in %s",
                    episodes instanceof RedisEpisodes ? "Redis" : "memory");
        }
    }

    /** Where the evaluator writes: the transition log, the case events and the metrics. */
    record Sinks(TransitionLog transitionLog, SymptomEvents events, MeterRegistry meters) {
    }

    /** Where the episodes and the duty counters are kept, and how a signal reads both. */
    record Stores(EpisodeRepository episodes, DutyStore duty, VehicleReads reads) {

        Stores(EpisodeRepository episodes, DutyStore duty) {
            this(episodes, duty, VehicleReads.of(episodes, duty));
        }

        /** In Redis when its URL is set, also when not consuming: closing a case drops its episode there. */
        static Stores of(EvaluatorRedis redis, Duration ttl) {
            if (redis.api().isEmpty() || redis.client().isEmpty()) {
                return new Stores(redis.episodes(ttl), new InMemoryDutyStore());
            }
            return new Stores(redis.episodes(ttl), new RedisDutyStore(redis.api().get(), ttl),
                    VehicleReads.redis(redis.client().get()));
        }
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
        this(enabled, catalog, sinks, clock, episodes, samples, lateFrames, lostSignal, holds, new InMemoryDutyStore());
    }

    @SuppressWarnings("java:S107") // As above, with where the duty counters are kept.
    EvaluatorStream(boolean enabled, EvaluatorCatalog catalog, Sinks sinks, Clock clock, EpisodeRepository episodes,
            SignalSamples samples, LateFrames lateFrames, LostSignalDetector lostSignal, Holds holds,
            DutyStore dutyStore) {
        this(enabled, catalog, sinks, clock, new Stores(episodes, dutyStore), samples, lateFrames, lostSignal, holds);
    }

    @SuppressWarnings("java:S107") // As above, with the stores and how a signal reads them.
    EvaluatorStream(boolean enabled, EvaluatorCatalog catalog, Sinks sinks, Clock clock, Stores stores,
            SignalSamples samples, LateFrames lateFrames, LostSignalDetector lostSignal, Holds holds) {
        this.duty = new DutyChecks(stores.duty());
        this.reads = stores.reads();
        this.holds = holds;
        this.lateFrames = lateFrames;
        this.lostSignal = lostSignal;
        this.enabled = enabled;
        this.catalog = catalog;
        this.transitionLog = sinks.transitionLog();
        this.events = sinks.events();
        this.meters = sinks.meters();
        this.clock = clock;
        this.episodes = stores.episodes();
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
        Holds held = holds.forSignal();
        if (GpsSignal.EVENTS_SCHEMA_ID.equals(signal.get("schema"))) {
            return deviceEvents(assetId, instant, signal, clients, held);
        }
        // The organizations' reads go out first and answer while the detector reads and writes its profiles.
        Supplier<Set<String>> withEpisodes = episodes.readTenantsWithEpisodes(assetId);
        List<Organization> organizations = new ArrayList<>();
        RuntimeException unread = null;
        try {
            clients.stream().filter(String.class::isInstance).map(String.class::cast)
                    .forEach(tenant -> organizations.add(read(tenant, assetId, forTenant(signal, tenant))));
        } catch (RuntimeException e) {
            unread = e;
        }
        // Before the organizations: a failing catalog or log must not keep the frame out of the profiles. Its
        // write goes on while the organizations run, and is waited for before the next signal.
        LostSignalDetector.Sent profiles = lostSignal.frameSent(assetId, instant, arrival(signal, arrivedAt), signal);
        int recorded = 0;
        boolean late = false;
        try {
            if (unread != null) {
                throw unread;
            }
            for (Organization o : organizations) {
                Evaluated e = evaluate(o, assetId, instant, held);
                recorded += e.transitions();
                late |= e.late();
            }
            for (String tenant : withEpisodes.get()) {
                if (!clients.contains(tenant)) {
                    recorded += reconcile(tenant, assetId, instant, Map.of("asset_id", assetId, "at", time, "trip",
                            NO_TRIP, FRAME, Map.of("events", List.of())), held);
                    recorded += reconcileDuty(tenant, assetId, instant, held);
                }
            }
        } finally {
            profiles.settle();
        }
        if (late) {
            meters.counter("miot.symptoms.evaluator.late", "sender", senderTag(signal.get("sender"))).increment();
        }
        return recorded;
    }

    /**
     * A signal of device events received outside the GPS frames: the symptoms that read device events run on it as
     * on a late frame, so it opens or raises their cases without moving the watermark the vehicle's frames keep.
     */
    private int deviceEvents(String assetId, Instant at, Map<String, Object> signal, List<?> clients, Holds held) {
        meters.counter("miot.symptoms.evaluator.device_events").increment();
        int recorded = 0;
        for (Object client : clients) {
            if (!(client instanceof String tenant)) {
                continue;
            }
            Map<String, Object> own = forTenant(signal, tenant);
            samples.keep(tenant, own);
            List<CompiledSymptom> symptoms = symptoms(tenant).stream().filter(CompiledSymptom::eventDriven).toList();
            if (!symptoms.isEmpty()) {
                AssetEpisodes state = episodes.load(tenant, assetId);
                state.restoreCases(transitionLog, symptoms);
                SignalEvaluator.Result result = new SignalEvaluator(state, held)
                        .evaluateLate(tenant, assetId, at, Map.of(SignalFields.ROOT, own), symptoms);
                recordTransitions(tenant, assetId, own, state, result, true, eventContext(own), held);
                episodes.save(state);
                count(result);
                recorded += result.transitions().size();
            }
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
     * The signal as the organization's rules read it: its own trip as {@code trip}, its own zones as
     * {@code geo} and its limits as {@code road}, none of the others, and the frame's events always a list
     * ({@link GpsSignal.FrameEvent}). An organization without zones gets no {@code geo}; one without a known
     * limit at the position gets no {@code road}. A signal without {@code roads} keeps its {@code road}.
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
        if (out.get("roads") instanceof Map<?, ?> byClient) {
            out.remove("roads");
            out.remove("road");
            if (byClient.get(tenant) != null) {
                out.put("road", byClient.get(tenant));
            }
        }
        return out;
    }

    /**
     * One organization's part of a signal, its reads started.
     *
     * @param reads null when the organization has no symptoms to run
     */
    private record Organization(String tenant, Map<String, Object> signal, List<CompiledSymptom> symptoms,
            List<CompiledSymptom> dutySymptoms, VehicleReads.Read reads) {
    }

    private Organization read(String tenant, String assetId, Map<String, Object> signal) {
        List<CompiledSymptom> symptoms = symptoms(tenant);
        List<CompiledSymptom> onDuty = dutySymptoms(tenant);
        VehicleReads.Read r = symptoms.isEmpty() && onDuty.isEmpty() ? null
                : reads.read(tenant, assetId, !onDuty.isEmpty());
        return new Organization(tenant, signal, symptoms, onDuty, r);
    }

    /**
     * The organization's symptoms on the signal, then the frame through its duty tracker and the symptoms that read
     * its counters ({@link #duty}). The case changes are recorded first, since a failed episode write replays the
     * signal and the log skips what it already holds; then the episodes are written once, and the tracker's state
     * last, so a failure before it replays the frame and the frame is applied again from the same state.
     */
    private Evaluated evaluate(Organization o, String assetId, Instant at, Holds held) {
        String tenant = o.tenant();
        samples.keep(tenant, o.signal());
        if (o.reads() == null) {
            return new Evaluated(0, false);
        }
        AssetEpisodes state = o.reads().episodes().get();
        state.restoreCases(transitionLog, Stream.concat(o.symptoms().stream(), o.dutySymptoms().stream()).toList());
        int recorded = 0;
        boolean late = false;
        boolean save = false;
        List<SignalEvaluator.Result> results = new ArrayList<>(2);
        if (!o.symptoms().isEmpty()) {
            Instant newest = state.watermark(tenant, assetId, SOURCE).orElse(null);
            late = newest != null && at.isBefore(newest);
            boolean afterTripEnd = lateTripEnded(o, late);
            // A late frame runs only the event-driven symptoms, without moving the watermark (a buffered panic or
            // sabotage event still opens its case); the others keep skipping it.
            if (!late || lateRuns(tenant, assetId, at, newest, o.signal(), o.symptoms(), afterTripEnd)) {
                SignalEvaluator evaluator = new SignalEvaluator(state, held);
                Map<String, Object> root = Map.of(SignalFields.ROOT, o.signal());
                SignalEvaluator.Result result = late ? evaluator.evaluateLate(tenant, assetId, at, root, o.symptoms(), afterTripEnd)
                        : evaluator.evaluate(tenant, assetId, at, root, o.symptoms());
                result = new SignalEvaluator.Result(SpeedLimitContext.with(o.signal(), result.transitions(),
                        o.symptoms()), result.errors());
                Map<String, Object> context = eventContext(o.signal());
                recordTransitions(tenant, assetId, o.signal(), state, result, late, context, held);
                results.add(result);
                recorded += result.transitions().size();
                save = true;
            }
        }
        DutyChecks.Check c = null;
        if (!o.dutySymptoms().isEmpty()) {
            // The episodes were read before the counters: a close during the reads invalidates this snapshot.
            c = duty.apply(tenant, at, o.signal(), o.reads().counters().get()).orElse(null);
            if (skippedDuty(c)) {
                meters.counter("miot.symptoms.duty.skipped").increment();
            } else {
                SignalEvaluator.Result result = new SignalEvaluator(state, held).evaluateUnder(DutyChecks.WATERMARK,
                        tenant, assetId, at, Map.of(TripCheck.ROOT, c.check()), o.dutySymptoms());
                state.keepContext(SignalEvaluator.activeTripId(Map.of(SignalFields.ROOT, o.signal())),
                        c.context(), at, o.dutySymptoms());
                recordTransitions(tenant, assetId, o.signal(), state, result, false, c.context(), held);
                results.add(result);
                recorded += result.transitions().size();
                save = true;
            }
        }
        if (save) {
            episodes.save(state);
        }
        if (c != null) {
            duty.save(tenant, assetId, c.next());
        }
        results.forEach(this::count);
        return new Evaluated(recorded, late);
    }

    /** A rejected frame can still carry a changed duty state to save, without a check to evaluate. */
    private static boolean skippedDuty(DutyChecks.Check check) {
        return check == null || !check.applied();
    }

    /** Ordinary buffered frames only need a preflight trip read when their spec opts in. */
    private boolean lateTripEnded(Organization organization, boolean late) {
        return late && organization.symptoms().stream().anyMatch(s -> !s.opensOnEvents() && s.allowsAfterTripEnd())
                && transitionLog.tripEnded(organization.tenant(), place(organization.signal()).tripId());
    }

    /**
     * After the organization's signal access ended, the existing episodes whose activation is false without its GPS
     * input advance; an organization without symptoms keeps its index current.
     */
    private int reconcile(String tenant, String assetId, Instant at, Map<String, Object> signal, Holds held) {
        List<CompiledSymptom> symptoms = symptoms(tenant);
        AssetEpisodes state = episodes.load(tenant, assetId);
        state.restoreCases(transitionLog, symptoms);
        if (symptoms.isEmpty()) {
            episodes.save(state);
            return 0;
        }
        Instant newest = state.watermark(tenant, assetId, SOURCE).orElse(null);
        if (newest != null && at.isBefore(newest)) {
            return 0;
        }
        SignalEvaluator.Result result = new SignalEvaluator(state, held).reconcile(tenant, assetId, at,
                Map.of(SignalFields.ROOT, signal), symptoms);
        recordTransitions(tenant, assetId, signal, state, result, false, eventContext(signal), held);
        episodes.save(state);
        count(result);
        return result.transitions().size();
    }

    /** Reconciles duty cases after signal access ends, without the tenant's GPS or trip data. */
    private int reconcileDuty(String tenant, String assetId, Instant at, Holds held) {
        List<CompiledSymptom> symptoms = dutySymptoms(tenant);
        if (symptoms.isEmpty()) {
            return 0;
        }
        AssetEpisodes state = episodes.load(tenant, assetId);
        state.restoreCases(transitionLog, symptoms);
        if (state.watermark(tenant, assetId, DutyChecks.WATERMARK).filter(at::isBefore).isPresent()) {
            return 0;
        }
        Map<String, Object> check = Map.of("trip", NO_TRIP);
        SignalEvaluator.Result result = new SignalEvaluator(state, held).reconcileUnder(DutyChecks.WATERMARK,
                tenant, assetId, at, Map.of(TripCheck.ROOT, check), symptoms);
        var next = duty.endTrip(tenant, assetId, at);
        Map<String, Object> context = Map.of(TripCheck.ROOT, Map.of());
        recordTransitions(tenant, assetId, Map.of(), state, result, false, context, held);
        episodes.save(state);
        count(result);
        next.ifPresent(s -> duty.save(tenant, assetId, s));
        return result.transitions().size();
    }

    /** CLOSED rows retain the case's trip and, off-trip, its last duty context and the standard reason. */
    private static List<Transition> asRecorded(List<Transition> transitions, AssetEpisodes state,
            Map<String, Object> signal, Map<String, Object> context) {
        String onTrip = SignalEvaluator.activeTripId(Map.of(SignalFields.ROOT, signal));
        return transitions.stream().map(t -> {
            if (t.kind() == Transition.Kind.CLOSED) {
                Episode e = state.loaded(t.definitionId()).orElse(null);
                if (e != null) {
                    Map<String, Object> closing = context != null && context.containsKey(TripCheck.ROOT)
                            && e.lastContext() != null ? e.lastContext() : context;
                    return t.closingOn(e.tripId(), onTrip, closing);
                }
            }
            return t;
        }).toList();
    }

    /** Hands a late frame to the late hook; true when an event-driven symptom still has to run on it. */
    private boolean lateRuns(String tenant, String assetId, Instant at, Instant newest, Map<String, Object> signal,
            List<CompiledSymptom> symptoms, boolean afterTripEnd) {
        try {
            lateFrames.late(tenant, assetId, at, newest, signal);
        } catch (RuntimeException e) {
            // A failed hook is not worth a redelivery.
            meters.counter("miot.symptoms.evaluator.late_hook_failed").increment();
        }
        return symptoms.stream().anyMatch(s -> s.eventDriven() || (afterTripEnd && s.allowsAfterTripEnd()));
    }

    /** The context a device-events signal's case changes keep: its event id. */
    private static Map<String, Object> eventContext(Map<String, Object> signal) {
        Object eventId = signal.get("event_id");
        return GpsSignal.EVENTS_SCHEMA_ID.equals(signal.get("schema")) && eventId instanceof String
                ? Map.of("event_id", eventId) : null;
    }

    /**
     * Records the result's case changes and publishes the ones new to the log, before the episodes are written: a
     * failed episode write replays the signal and the log skips what it already holds.
     */
    @SuppressWarnings("java:S107") // The result, where it comes from, and what the changes keep.
    private void recordTransitions(String tenant, String assetId, Map<String, Object> signal, AssetEpisodes state,
            SignalEvaluator.Result result, boolean late, Map<String, Object> context, Holds held) {
        if (result.transitions().isEmpty()) {
            return;
        }
        TransitionLog.Place place = place(signal);
        List<Transition> changes = asRecorded(result.transitions(), state, signal, context);
        // Only the changes new to the log: a replayed signal publishes nothing twice.
        TransitionLog.Appended appended = transitionLog.appendEvaluated(tenant, changes, place, context);
        appended.discarded().forEach(id -> state.delete(tenant, assetId, id));
        List<TransitionLog.Recorded> recorded = appended.recorded();
        events.transitions(tenant, recorded.stream()
                .filter(r -> !held.held(tenant, assetId, r.transition().definitionId(), Instant.EPOCH))
                .toList(), place);
        if (late) {
            // A late opening the log already holds is a replay of a case that may be closed since: it keeps no
            // episode, or that episode would block the next real event.
            changes.stream()
                    .filter(t -> t.kind() == Transition.Kind.OPENED)
                    .filter(t -> recorded.stream().noneMatch(r -> r.transition().kind() == Transition.Kind.OPENED
                            && r.transition().definitionId().equals(t.definitionId())
                            && r.transition().at().equals(t.at()) && r.transition().version().equals(t.version())))
                    .forEach(t -> state.delete(tenant, assetId, t.definitionId()));
        }
    }

    /** Counts the result's case changes and rule errors, once its episodes are written. */
    private void count(SignalEvaluator.Result result) {
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
        forget(tenant, assetId, definitionId, (Episode) null);
    }

    /**
     * As {@link #forget(String, String, java.util.UUID)}, and the episode keeps the case's trip, so the open rule
     * reads {@code case.closed_on_trip} true while the vehicle stays on that trip.
     */
    public void forget(String tenant, String assetId, java.util.UUID definitionId, String tripId) {
        forget(tenant, assetId, definitionId, tripId == null ? null : Episode.closedOnTrip(definitionId, assetId,
                tripId, clock.instant()));
    }

    /**
     * As {@link #forget(String, String, java.util.UUID, String)}, and while the condition holds on the case's trip
     * the symptom opens a new case only above the close's {@link OperatorClose#reopenAbove()}.
     */
    public void closedByOperator(String tenant, String assetId, java.util.UUID definitionId, OperatorClose close) {
        forget(tenant, assetId, definitionId, close.marker(definitionId, assetId));
    }

    private void forget(String tenant, String assetId, java.util.UUID definitionId, Episode marker) {
        // Reset counters before exposing a closed episode, so an interleaved frame cannot reopen from old duty.
        if (dutySymptoms(tenant).stream().anyMatch(s -> s.definitionId().equals(definitionId)
                && DutyChecks.readsDuty(s))) {
            duty.restartDuty(tenant, assetId);
        }
        // Both consumers may share Redis. Neither close may expose an empty episode before installing its marker.
        lostSignal.forget(tenant, assetId, definitionId, marker);
        episodes.operatorClose(tenant, assetId, definitionId, marker);
    }

    /** Drops only the case the sweep closed, preserving a newer episode opened on another replica. */
    public void forgetStale(StaleCase c) {
        episodes.forgetStale(c.tenantCode(), c.assetId(), c.definitionId(),
                c.test() ? SymptomState.TEST : SymptomState.ACTIVE, c.openedAt());
        lostSignal.forgetStale(c);
    }

    /** Rechecks the latest condition evidence before releasing a hold, then restarts its level timers. */
    public void finishHold(IgnoreHold h) {
        AssetEpisodes state = episodes.load(h.tenantCode(), h.assetId());
        List<CompiledSymptom> covered = Stream.concat(catalog.forSource(h.tenantCode(), SOURCE).symptoms().stream(),
                catalog.forSource(h.tenantCode(), TripCheck.KEY).symptoms().stream())
                .filter(s -> state.find(h.tenantCode(), h.assetId(), s.definitionId())
                        .map(e -> h.covers(h.assetId(), s.definitionId(), e.openedAt())).orElse(false))
                .toList();
        state.restoreCases(transitionLog, covered);
        List<Transition> closed = new SignalEvaluator(state).finishHold(h.tenantCode(), h.assetId(), clock.instant(),
                covered);
        if (!closed.isEmpty()) {
            List<Transition> changes = closed.stream().map(t -> {
                Episode e = state.loaded(t.definitionId()).orElseThrow();
                String activeTrip = e.tripEnded() || e.offTripSince() != null ? null : e.tripId();
                return t.closingOn(e.tripId(), activeTrip, e.lastContext());
            }).toList();
            transitionLog.append(h.tenantCode(), changes, new TransitionLog.Place(h.tripId(), null, null, null, null));
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

    /** The organization's {@code trip_check} symptoms that read the duty counters. */
    private List<CompiledSymptom> dutySymptoms(String tenant) {
        Instant now = clock.instant();
        Cached c = dutyVersions.get(tenant);
        if (c == null || c.at().plus(VERSIONS_TTL).isBefore(now)) {
            c = new Cached(now, catalog.forSource(tenant, TripCheck.KEY).symptoms().stream()
                    .filter(DutyChecks::readsCounters).toList());
            dutyVersions.put(tenant, c);
        }
        return c.symptoms();
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
