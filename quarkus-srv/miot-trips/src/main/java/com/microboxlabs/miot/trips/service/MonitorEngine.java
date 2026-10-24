package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.MonitorRun;
import com.microboxlabs.miot.trips.domain.MonitorSelector;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.monitor.MonitorLanguage;
import com.microboxlabs.miot.trips.monitor.MonitorSchema;
import com.microboxlabs.miot.trips.store.AssignmentStore;
import com.microboxlabs.miot.trips.store.LocationStore;
import com.microboxlabs.miot.trips.store.MonitorRunStore;
import com.microboxlabs.miot.trips.store.MonitorStore;
import com.microboxlabs.miot.trips.store.StageStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.jboss.logging.Logger;

/**
 * Runs trip monitors. Each audited change of a trip becomes an event ({@code plan}, {@code stage}); signals and due
 * timers come in through {@link #signal} and {@link #fireTimer}. Per event, the active rules of its trigger are
 * evaluated by priority: the state actions of the first matching rule are applied, under a savepoint so a failing
 * action undoes only itself; alerts and processes of every matching rule are recorded. Stage changes the actions
 * cause are evaluated next, in the same transaction, up to {@value #MAX_DEPTH} levels. Then the trip's epoch rises
 * and its timers are scheduled again. A stage started or closed by hand is a {@code command} and then a
 * {@code stage} event.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class MonitorEngine implements TripChanges {

    static final int MAX_DEPTH = 5;
    private static final Logger LOG = Logger.getLogger(MonitorEngine.class);
    private static final Set<String> STATE_ACTIONS =
            Set.of("advance", "start", "close", "completeTrip", "cancelTrip", "closeMandates");
    private static final String TIMER = "timer";
    private static final String STAGE_TYPE = "stageType";

    /** The evaluation running on this thread; changes made by its actions queue up here. */
    private static final ThreadLocal<Run> RUN = new ThreadLocal<>();

    private final MonitorRunStore runs;
    private final MonitorStore monitors;
    private final TripStore trips;
    private final StageStore stageStore;
    private final StageService stages;
    private final TripService tripService;
    private final MandateService mandates;
    private final AuditService audit;
    private final Transactions tx;
    private final Clock clock;
    private final MonitorContext context;
    private final Map<String, TripMonitor> published = new ConcurrentHashMap<>();
    private final Map<String, MonitorLanguage.Prepared> prepared = new ConcurrentHashMap<>();

    private static final class Run {
        private final Deque<Queued> queue = new ArrayDeque<>();
        private final Set<String> touched = new LinkedHashSet<>();
        private final List<MonitorRun.Transition> recorded = new ArrayList<>();
        private int depth;
    }

    private record Queued(MonitorRun.Event event, int depth) {
    }

    @Inject
    public MonitorEngine(MonitorRunStore runs, MonitorStore monitors, TripStore trips, StageStore stageStore,
            AssignmentStore assignments, LocationStore locations, StageService stages, TripService tripService,
            MandateService mandates, FleetResources fleet, AuditService audit, Transactions tx) {
        this(runs, monitors, trips, stageStore, assignments, locations, stages, tripService, mandates, fleet, audit,
                tx, Clock.systemUTC());
    }

    public MonitorEngine(MonitorRunStore runs, MonitorStore monitors, TripStore trips, StageStore stageStore,
            AssignmentStore assignments, LocationStore locations, StageService stages, TripService tripService,
            MandateService mandates, FleetResources fleet, AuditService audit, Transactions tx, Clock clock) {
        this.runs = runs;
        this.monitors = monitors;
        this.trips = trips;
        this.stageStore = stageStore;
        this.stages = stages;
        this.tripService = tripService;
        this.mandates = mandates;
        this.audit = audit;
        this.tx = tx;
        this.clock = clock;
        this.context = new MonitorContext(trips, stageStore, assignments, locations, mandates, fleet);
    }

    @Override
    public void changed(String tenantCode, String actor, String action, String tripId, Map<String, Object> details) {
        MonitorRun.Event event = eventOf(tenantCode, actor, action, tripId, details);
        if (event == null) {
            return;
        }
        Run run = RUN.get();
        if (run != null) {
            run.queue.add(new Queued(event, run.depth + 1));
            return;
        }
        List<MonitorRun.Event> events = new ArrayList<>();
        if ("stage".equals(event.on())) {
            events.add(new MonitorRun.Event(tenantCode, tripId, "command",
                    "started".equals(event.kind()) ? "start" : "close", event.at(), actor, event.data()));
        }
        events.add(event);
        try {
            // a failure here must not undo the change that was audited
            PgTx.savepoint(() -> process(events));
        } catch (RuntimeException e) {
            LOG.errorf(e, "Monitor evaluation failed: tenant=%s trip=%s action=%s", tenantCode, tripId, action);
        }
    }

    /** Delivers a signal (GPS, rFMS) to the trip; returns what it did. */
    public List<MonitorRun.Transition> signal(String tenantCode, String actor, UUID tripId, String kind,
            String geofenceId, OffsetDateTime at) {
        String k = Check.required(kind, "kind", 64);
        Map<String, Object> data = new LinkedHashMap<>();
        if (geofenceId != null && !geofenceId.isBlank()) {
            data.put("geofenceId", Check.limited(geofenceId.trim(), "geofenceId", 64));
        }
        return process(List.of(new MonitorRun.Event(tenantCode, tripId.toString(), "signal", k,
                at == null ? now() : at, actor, data)));
    }

    /** Evaluates a timer the clock claimed. */
    public List<MonitorRun.Transition> fireTimer(MonitorRun.Timer timer) {
        return process(List.of(new MonitorRun.Event(timer.tenantCode(), timer.tripId(), TIMER, timer.ruleKey(),
                timer.dueAt(), "monitor:clock", Map.of("timerId", timer.id()))));
    }

    /** Moves an open trip to another monitor, or to another version of its own (newest published by default). */
    public MonitorRun.State bind(String tenantCode, String actor, UUID tripId, String monitorKey, Integer version) {
        return tx.inTransaction(() -> {
            Trip trip = trips.find(tenantCode, tripId).orElseThrow(() -> new NoSuchElementException("trip not found"));
            if (finished(trip)) {
                throw new IllegalStateException("trip already " + trip.status());
            }
            String key = Check.required(monitorKey, "monitorKey", 64);
            TripMonitor m = version == null ? newest(tenantCode, key)
                    .orElseThrow(() -> new IllegalArgumentException("monitor " + key + " has no published version"))
                    : monitors.version(tenantCode, key, version)
                            .filter(v -> TripMonitor.PUBLISHED.equals(v.status()))
                            .orElseThrow(() -> new IllegalArgumentException(
                                    "monitor " + key + " has no published version " + version));
            MonitorRun.State state = runs.bind(tenantCode, tripId, key, m.version(), actor);
            audit.log(tenantCode, actor, "monitor.bound", "trip", tripId.toString(), null,
                    Map.of("monitor", key, "version", m.version()));
            reschedule(tenantCode, tripId);
            return runs.state(tenantCode, tripId).orElse(state);
        });
    }

    public Optional<MonitorRun.State> state(String tenantCode, UUID tripId) {
        return runs.state(tenantCode, tripId);
    }

    public List<MonitorRun.Timer> pendingTimers(String tenantCode, UUID tripId) {
        return runs.pendingTimers(tenantCode, tripId);
    }

    public List<MonitorRun.Transition> transitions(String tenantCode, UUID tripId, Integer limit) {
        int n = limit == null ? 100 : limit;
        if (n < 1 || n > 500) {
            throw new IllegalArgumentException("limit must be between 1 and 500");
        }
        return runs.transitions(tenantCode, tripId, n);
    }

    private List<MonitorRun.Transition> process(List<MonitorRun.Event> events) {
        Run run = new Run();
        events.forEach(e -> run.queue.add(new Queued(e, 0)));
        RUN.set(run);
        try {
            return tx.inTransaction(() -> {
                while (!run.queue.isEmpty()) {
                    Queued q = run.queue.poll();
                    run.depth = q.depth();
                    evaluate(run, q);
                }
                for (String touched : run.touched) {
                    String[] parts = touched.split("\\|", 2);
                    reschedule(parts[0], UUID.fromString(parts[1]));
                }
                return List.copyOf(run.recorded);
            });
        } finally {
            RUN.remove();
        }
    }

    private void evaluate(Run run, Queued q) {
        MonitorRun.Event e = q.event();
        String tenant = e.tenantCode();
        UUID tripId = UUID.fromString(e.tripId());
        Optional<Trip> found = trips.find(tenant, tripId);
        if (found.isEmpty()) {
            return;
        }
        Trip trip = found.get();
        Optional<MonitorRun.State> state = runs.state(tenant, tripId);
        if (state.isEmpty() && "plan".equals(e.on()) && "created".equals(e.kind())) {
            state = bindNew(trip, e);
        }
        if (state.isEmpty()) {
            return;
        }
        run.touched.add(tenant + "|" + tripId);
        if (finished(trip)) {
            return;
        }
        if (TIMER.equals(e.on()) && !due(e, state.get())) {
            return;
        }
        TripMonitor m = monitor(tenant, state.get().monitorKey(), state.get().monitorVersion()).orElse(null);
        if (m == null) {
            return;
        }
        if (q.depth() > MAX_DEPTH) {
            record(run, m, e, q.depth(), List.of(), null, running(trip), running(trip), List.of(),
                    "more than " + MAX_DEPTH + " chained events: the rules start each other");
            return;
        }
        Map<String, Object> ctx = context.of(trip, e, m.params());
        String from = running(trip);
        String actor = "monitor:" + m.monitorKey() + "@v" + m.version();
        List<String> matched = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        List<Map<String, Object>> done = new ArrayList<>();
        TripMonitor.Rule stateRule = null;
        for (TripMonitor.Rule r : m.rules()) {
            if (!r.active() || !r.on().equals(e.on()) || (TIMER.equals(e.on()) && !r.key().equals(e.kind()))) {
                continue;
            }
            if (!holds(m, r, ctx, errors)) {
                continue;
            }
            matched.add(r.key());
            List<TripMonitor.Action> stateActions = r.then().stream()
                    .filter(a -> STATE_ACTIONS.contains(a.type())).toList();
            if (!stateActions.isEmpty() && stateRule == null) {
                stateRule = r;
                int queued = run.queue.size();
                try {
                    List<Map<String, Object>> applied = new ArrayList<>();
                    PgTx.savepoint(() -> {
                        for (TripMonitor.Action a : stateActions) {
                            applied.add(apply(tenant, tripId, a, actor));
                        }
                        return null;
                    });
                    done.addAll(applied);
                } catch (RuntimeException ex) {
                    while (run.queue.size() > queued) {
                        run.queue.pollLast();
                    }
                    errors.add(r.key() + ": " + message(ex));
                }
            }
            for (TripMonitor.Action a : r.then()) {
                if (!STATE_ACTIONS.contains(a.type())) {
                    done.add(action(a, r.key(), "recorded"));
                }
            }
        }
        if (matched.isEmpty() && errors.isEmpty()) {
            return;
        }
        Trip after = trips.find(tenant, tripId).orElse(trip);
        record(run, m, e, q.depth(), matched, stateRule == null ? null : stateRule.key(), from, running(after), done,
                errors.isEmpty() ? null : String.join("; ", errors));
    }

    /** A timer fires once, and only while the trip has not changed since it was scheduled. */
    private boolean due(MonitorRun.Event e, MonitorRun.State state) {
        Object id = e.data().get("timerId");
        if (!(id instanceof Number n)) {
            return false;
        }
        Optional<MonitorRun.Timer> timer = runs.timer(n.longValue());
        if (timer.isEmpty() || timer.get().firedAt() != null || timer.get().epoch() != state.epoch()) {
            return false;
        }
        runs.markFired(n.longValue());
        return true;
    }

    private boolean holds(TripMonitor m, TripMonitor.Rule r, Map<String, Object> ctx, List<String> errors) {
        if (r.when() == null || r.when().isBlank()) {
            return true;
        }
        MonitorLanguage.Result result = prepared(m, r, "when", r.when()).run(ctx);
        if (!result.ok()) {
            errors.add(r.key() + ": " + result.error());
            return false;
        }
        return Boolean.TRUE.equals(result.value());
    }

    private Map<String, Object> apply(String tenant, UUID tripId, TripMonitor.Action a, String actor) {
        String v = a.value();
        switch (a.type()) {
            case "advance" -> {
                Stage target = pending(tenant, tripId, v)
                        .orElseThrow(() -> new IllegalStateException("no pending " + v + " stage"));
                Optional<Stage> current = running(tenant, tripId);
                if (current.isPresent()) {
                    stages.close(tenant, actor, UUID.fromString(current.get().id()));
                }
                stages.start(tenant, actor, UUID.fromString(target.id()));
            }
            case "start" -> stages.start(tenant, actor, UUID.fromString(pending(tenant, tripId, v)
                    .orElseThrow(() -> new IllegalStateException("no pending " + v + " stage")).id()));
            case "close" -> stages.close(tenant, actor, UUID.fromString(running(tenant, tripId)
                    .filter(s -> s.stageType().equals(v))
                    .orElseThrow(() -> new IllegalStateException("the " + v + " stage is not in progress")).id()));
            case "completeTrip" -> completeTrip(tenant, tripId, actor);
            case "cancelTrip" -> tripService.cancel(tenant, actor, tripId, v);
            case "closeMandates" -> {
                return closeMandates(tenant, tripId, actor);
            }
            default -> throw new IllegalStateException("unknown action " + a.type());
        }
        return action(a, null, "done");
    }

    /** Closes the running stage and runs the closing stage through; closing it completes the trip. */
    private void completeTrip(String tenant, UUID tripId, String actor) {
        Optional<Stage> current = running(tenant, tripId);
        if (current.isPresent() && !"closing".equals(current.get().stageType())) {
            stages.close(tenant, actor, UUID.fromString(current.get().id()));
        }
        Stage closing = trip(tenant, tripId).stream().filter(s -> "closing".equals(s.stageType())).findFirst()
                .orElseThrow(() -> new IllegalStateException("the trip has no closing stage"));
        if (Stage.PENDING.equals(closing.status())) {
            stages.start(tenant, actor, UUID.fromString(closing.id()));
        }
        if (!Stage.CLOSED.equals(closing.status())) {
            stages.close(tenant, actor, UUID.fromString(closing.id()));
        }
    }

    /** Closes the trip's mandates that can close; one with other open trips stays open. */
    private Map<String, Object> closeMandates(String tenant, UUID tripId, String actor) {
        List<String> closed = new ArrayList<>();
        List<String> kept = new ArrayList<>();
        for (MandateRef ref : trips.mandatesOf(tenant, tripId)) {
            try {
                PgTx.savepoint(() -> mandates.close(tenant, actor, UUID.fromString(ref.mandateId())));
                closed.add(ref.externalCode());
            } catch (RuntimeException e) {
                kept.add(ref.externalCode() + ": " + message(e));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", "closeMandates");
        out.put("result", "done");
        out.put("closed", closed);
        out.put("kept", kept);
        return out;
    }

    /** Schedules the trip's timer rules again from its current state; a rule fires once per due time. */
    private void reschedule(String tenant, UUID tripId) {
        Optional<MonitorRun.State> state = runs.state(tenant, tripId);
        if (state.isEmpty()) {
            return;
        }
        runs.dropPendingTimers(tenant, tripId);
        Optional<Trip> trip = trips.find(tenant, tripId);
        if (trip.isEmpty() || finished(trip.get())) {
            return;
        }
        int epoch = runs.nextEpoch(tenant, tripId);
        TripMonitor m = monitor(tenant, state.get().monitorKey(), state.get().monitorVersion()).orElse(null);
        if (m == null) {
            return;
        }
        for (TripMonitor.Rule r : m.rules()) {
            if (!r.active() || !TIMER.equals(r.on())) {
                continue;
            }
            Map<String, Object> ctx = context.of(trip.get(), new MonitorRun.Event(tenant, tripId.toString(), TIMER,
                    r.key(), now(), "monitor:clock", Map.of()), m.params());
            MonitorLanguage.Result at = prepared(m, r, "at", r.at()).run(ctx);
            if (at.ok() && at.value() instanceof Instant i) {
                OffsetDateTime due = OffsetDateTime.ofInstant(i, ZoneOffset.UTC);
                if (!runs.fired(tenant, tripId, r.key(), due)) {
                    runs.schedule(tenant, tripId, r.key(), m.version(), due, epoch);
                }
            }
        }
    }

    /** A new trip gets the monitor it asked for, or the selector's; empty when neither gives one. */
    private Optional<MonitorRun.State> bindNew(Trip trip, MonitorRun.Event e) {
        String tenant = trip.tenantCode();
        Object asked = e.data().get("monitor");
        String key = asked instanceof String s ? s : select(trip).orElse(null);
        if (key == null) {
            return Optional.empty();
        }
        Optional<TripMonitor> m = newest(tenant, key);
        if (m.isEmpty()) {
            LOG.warnf("Trip %s asked for monitor %s, which has no published version", trip.id(), key);
            return Optional.empty();
        }
        MonitorRun.State state = runs.bind(tenant, UUID.fromString(trip.id()), key, m.get().version(), e.actor());
        audit.log(tenant, e.actor(), "monitor.bound", "trip", trip.id(), null,
                Map.of("monitor", key, "version", m.get().version()));
        return Optional.of(state);
    }

    private Optional<String> select(Trip trip) {
        List<MonitorSelector> entries = monitors.selector(trip.tenantCode());
        if (entries.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Object> ctx = context.ofNewTrip(trip);
        for (MonitorSelector s : entries) {
            MonitorLanguage.Result r = MonitorLanguage.evaluate(MonitorSchema.selector(), s.condition(), ctx);
            if (r.ok() && Boolean.TRUE.equals(r.value())) {
                return Optional.of(s.monitorKey());
            }
        }
        return Optional.empty();
    }

    private Optional<TripMonitor> newest(String tenant, String key) {
        return monitors.versions(tenant, key).stream().filter(v -> TripMonitor.PUBLISHED.equals(v.status()))
                .findFirst();
    }

    /** A published version never changes, so it is read once. */
    private Optional<TripMonitor> monitor(String tenant, String key, int version) {
        String id = tenant + "|" + key + "|" + version;
        TripMonitor cached = published.get(id);
        if (cached != null) {
            return Optional.of(cached);
        }
        Optional<TripMonitor> m = monitors.version(tenant, key, version)
                .filter(v -> TripMonitor.PUBLISHED.equals(v.status()));
        m.ifPresent(v -> published.put(id, v));
        return m;
    }

    private MonitorLanguage.Prepared prepared(TripMonitor m, TripMonitor.Rule r, String field, String expression) {
        String id = m.tenantCode() + "|" + m.monitorKey() + "|" + m.version() + "|" + r.key() + "|" + field;
        return prepared.computeIfAbsent(id,
                k -> MonitorLanguage.prepare(MonitorSchema.of(r.on(), m.params()), expression));
    }

    private void record(Run run, TripMonitor m, MonitorRun.Event e, int depth, List<String> matched,
            String ruleKey, String from, String to, List<Map<String, Object>> actions, String error) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("on", e.on());
        event.put("kind", e.kind());
        event.put("at", e.at().toString());
        event.put("actor", e.actor());
        if (!e.data().isEmpty()) {
            event.put("data", e.data());
        }
        MonitorRun.Transition t = new MonitorRun.Transition(0, e.tenantCode(), e.tripId(), m.monitorKey(),
                m.version(), event, depth, matched, ruleKey, from, to, actions, error, e.at(), null);
        runs.record(t);
        run.recorded.add(t);
    }

    private static Map<String, Object> action(TripMonitor.Action a, String rule, String result) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", a.type());
        if (a.value() != null) {
            out.put("value", a.value());
        }
        if (rule != null) {
            out.put("rule", rule);
        }
        out.put("result", result);
        return out;
    }

    /** The audited change as a monitor event; null for changes no rule reacts to. */
    static MonitorRun.Event eventOf(String tenant, String actor, String action, String tripId,
            Map<String, Object> details) {
        OffsetDateTime at = OffsetDateTime.now(ZoneOffset.UTC);
        Map<String, Object> d = details == null ? Map.of() : details;
        String[] onKind = switch (action) {
            case "trip.created" -> new String[] {"plan", "created"};
            case "trip.updated" -> new String[] {"plan", "trip"};
            case "trip.mandate_linked", "trip.mandate_unlinked" -> new String[] {"plan", "mandates"};
            case "stage.added", "stage.updated" -> new String[] {"plan", "stages"};
            case "assignment.created", "assignment.ended" -> new String[] {"plan", "resources"};
            case "stage.started" -> new String[] {"stage", "started"};
            case "stage.closed" -> new String[] {"stage", "closed"};
            default -> action.startsWith("trip_cargo.") ? new String[] {"plan", "cargo"} : null;
        };
        if (onKind == null) {
            return null;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        if (d.get(STAGE_TYPE) != null) {
            data.put(STAGE_TYPE, d.get(STAGE_TYPE));
        }
        if (d.get("monitor") != null) {
            data.put("monitor", d.get("monitor"));
        }
        return new MonitorRun.Event(tenant, tripId, onKind[0], onKind[1], at, actor, data);
    }

    private List<Stage> trip(String tenant, UUID tripId) {
        return stageStore.listBySubject(tenant, Stage.SUBJECT_TRIP, tripId).stream()
                .sorted(Comparator.comparingInt(Stage::seq)).toList();
    }

    private Optional<Stage> running(String tenant, UUID tripId) {
        return trip(tenant, tripId).stream().filter(s -> Stage.RUNNING.equals(s.status())).findFirst();
    }

    private Optional<Stage> pending(String tenant, UUID tripId, String type) {
        return trip(tenant, tripId).stream()
                .filter(s -> Stage.PENDING.equals(s.status()) && s.stageType().equals(type)).findFirst();
    }

    private String running(Trip trip) {
        return running(trip.tenantCode(), UUID.fromString(trip.id())).map(Stage::stageType).orElse(null);
    }

    private static boolean finished(Trip trip) {
        return Trip.DONE.equals(trip.status()) || Trip.CANCELLED.equals(trip.status());
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }

    private static String message(RuntimeException e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }
}
