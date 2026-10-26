package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.DeliveryCycle;
import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.MonitorRun;
import com.microboxlabs.miot.trips.domain.MonitorSelector;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.events.TripEvents;
import com.microboxlabs.miot.trips.dto.StageRequest;
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
 * {@code stage} event. A milestone confirmed or rejected is the {@code command} {@code <milestone>_confirmed} or
 * {@code <milestone>_rejected} at the confirmed time; {@code requestConfirmation} leaves a milestone pending.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class MonitorEngine implements TripChanges {

    private static final String CLOSE_MANDATES = "closeMandates";
    private static final String CLOSE = "close";
    private static final String START = "start";
    private static final String STAGE = "stage";
    private static final String MONITOR = "monitor";
    static final int MAX_DEPTH = 5;
    private static final Logger LOG = Logger.getLogger(MonitorEngine.class);
    private static final Set<String> STATE_ACTIONS =
            Set.of("advance", START, CLOSE, "completeTrip", "cancelTrip", CLOSE_MANDATES);
    private static final String TIMER = "timer";
    private static final String STAGE_TYPE = "stageType";
    private static final String COMMAND = "command";
    private static final String REGULARIZED = "regularized";
    private static final String SOURCE = "source";
    private static final String REQUEST_CONFIRMATION = "requestConfirmation";
    private static final String DELIVERY_RULE = "delivery";
    private static final String DELIVERY_PREFIX = "delivery_";
    private static final String CONFIRMED_SUFFIX = "_confirmed";
    private static final String CLOSURE_CONFIRMED = TripMilestone.CLOSURE + CONFIRMED_SUFFIX;

    /** The evaluation running on this thread; changes made by its actions queue up here. */
    private static final ThreadLocal<Run> RUN = new ThreadLocal<>();

    private final MonitorRunStore runs;
    private final MonitorStore monitors;
    private final TripStore trips;
    private final StageStore stageStore;
    private final StageService stages;
    private final TripService tripService;
    private final MandateService mandates;
    private final MilestoneService milestones;
    private final AuditService audit;
    private final TripEvents events;
    private final Transactions tx;
    private final Clock clock;
    private final MonitorContext context;
    private final DeliveryReach deliveries;
    private final Map<String, TripMonitor> published = new ConcurrentHashMap<>();
    private final Map<String, MonitorLanguage.Prepared> prepared = new ConcurrentHashMap<>();

    private static final class Run {
        private final Deque<Queued> queue = new ArrayDeque<>();
        private final Set<String> touched = new LinkedHashSet<>();
        private final List<MonitorRun.Transition> recorded = new ArrayList<>();
        private final Set<String> alerts = new java.util.HashSet<>();
        private int depth;
    }

    private record Queued(MonitorRun.Event event, int depth) {
    }

    @Inject
    @SuppressWarnings("java:S107") // CDI wiring requires the monitor's existing service dependencies.
    public MonitorEngine(MonitorRunStore runs, MonitorStore monitors, TripStore trips, StageStore stageStore,
            AssignmentStore assignments, LocationStore locations, StageService stages, TripService tripService,
            MandateService mandates, MilestoneService milestones, FleetResources fleet, AuditService audit,
            TripEvents events, Transactions tx, DeliveryService deliveries) {
        this(runs, monitors, trips, stageStore, assignments, locations, stages, tripService, mandates, milestones,
                fleet, audit, events, tx, Clock.systemUTC(), deliveries);
    }

    /** Without trip events. */
    @SuppressWarnings("java:S107") // Preserves the constructor used by existing in-memory monitor tests.
    public MonitorEngine(MonitorRunStore runs, MonitorStore monitors, TripStore trips, StageStore stageStore,
            AssignmentStore assignments, LocationStore locations, StageService stages, TripService tripService,
            MandateService mandates, MilestoneService milestones, FleetResources fleet, AuditService audit,
            Transactions tx, Clock clock) {
        this(runs, monitors, trips, stageStore, assignments, locations, stages, tripService, mandates, milestones,
                fleet, audit, TripEvents.NONE, tx, clock);
    }

    @SuppressWarnings("java:S107") // The Clock overload mirrors the CDI constructor for deterministic tests.
    public MonitorEngine(MonitorRunStore runs, MonitorStore monitors, TripStore trips, StageStore stageStore,
            AssignmentStore assignments, LocationStore locations, StageService stages, TripService tripService,
            MandateService mandates, MilestoneService milestones, FleetResources fleet, AuditService audit,
            TripEvents events, Transactions tx, Clock clock) {
        this(runs, monitors, trips, stageStore, assignments, locations, stages, tripService, mandates, milestones,
                fleet, audit, events, tx, clock, DeliveryReach.NONE);
    }

    /** {@code deliveries} tells whether the loads reached the step that completes the trip. */
    @SuppressWarnings("java:S107") // The constructor above with the trip's deliveries.
    public MonitorEngine(MonitorRunStore runs, MonitorStore monitors, TripStore trips, StageStore stageStore,
            AssignmentStore assignments, LocationStore locations, StageService stages, TripService tripService,
            MandateService mandates, MilestoneService milestones, FleetResources fleet, AuditService audit,
            TripEvents events, Transactions tx, Clock clock, DeliveryReach deliveries) {
        this.runs = runs;
        this.monitors = monitors;
        this.trips = trips;
        this.stageStore = stageStore;
        this.stages = stages;
        this.tripService = tripService;
        this.mandates = mandates;
        this.milestones = milestones;
        this.audit = audit;
        this.events = events;
        this.tx = tx;
        this.clock = clock;
        this.deliveries = deliveries;
        this.context = new MonitorContext(trips, stageStore, assignments, locations, mandates, milestones, fleet,
                deliveries);
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
        String command = "started".equals(event.kind()) ? START : CLOSE;
        List<MonitorRun.Event> queuedEvents = STAGE.equals(event.on())
                ? List.of(new MonitorRun.Event(tenantCode, tripId, COMMAND,
                        command, event.at(), actor, event.data()), event)
                : List.of(event);
        try {
            // a failure here must not undo the change that was audited
            PgTx.savepoint(() -> process(queuedEvents));
        } catch (RuntimeException e) {
            LOG.errorf(e, "Monitor evaluation failed: tenant=%s trip=%s action=%s", tenantCode, tripId, action);
        }
    }

    /** Delivers a signal (GPS, rFMS) to the trip; returns what it did. */
    public List<MonitorRun.Transition> signal(String tenantCode, String actor, UUID tripId, String kind,
            String geofenceId, OffsetDateTime at) {
        return signal(tenantCode, actor, tripId, kind, geofenceId, at, null);
    }

    /** A signal that names what produced it, such as {@code eta}; without it a signal is a GPS detection. */
    public List<MonitorRun.Transition> signal(String tenantCode, String actor, UUID tripId, String kind,
            String geofenceId, OffsetDateTime at, String source) {
        String k = Check.required(kind, "kind", 64);
        Map<String, Object> data = new LinkedHashMap<>();
        if (source != null && !source.isBlank()) {
            data.put(SOURCE, Check.limited(source.trim(), SOURCE, 32));
        }
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
            runs.dropPendingTimers(tenantCode, tripId);
            MonitorRun.State state = runs.bind(tenantCode, tripId, key, m.version(), actor);
            audit.log(tenantCode, actor, "monitor.bound", "trip", tripId.toString(), null,
                    Map.of(MONITOR, key, "version", m.version()));
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

    private List<MonitorRun.Transition> process(List<MonitorRun.Event> queuedEvents) {
        Run run = new Run();
        queuedEvents.forEach(e -> run.queue.add(new Queued(e, 0)));
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
        if (finished(trip) && !STAGE.equals(e.on()) && !COMMAND.equals(e.on())) {
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
            recordTransition(run, m, q, new TransitionResult(List.of(), null, running(trip), running(trip), List.of(),
                    "more than " + MAX_DEPTH + " chained events: the rules start each other"));
            return;
        }
        evaluateRules(run, q, trip, m);
        completeByDeliveries(run, q, m);
    }

    /**
     * When the monitor names the delivery step that completes the trip ({@code deliveryCompletesTrip}), a confirmed
     * monitoring closure or delivery step completes the trip once the closure is confirmed and every load reached
     * that step. Recorded as the transition of the rule {@value #DELIVERY_RULE}.
     */
    private void completeByDeliveries(Run run, Queued q, TripMonitor m) {
        MonitorRun.Event e = q.event();
        if (!COMMAND.equals(e.on()) || e.kind() == null || !(CLOSURE_CONFIRMED.equals(e.kind())
                || e.kind().startsWith(DELIVERY_PREFIX) && e.kind().endsWith(CONFIRMED_SUFFIX))) {
            return;
        }
        String step;
        try {
            step = DeliveryCycle.of(m.params()).completesTrip();
        } catch (IllegalArgumentException ex) {
            return;
        }
        String tenant = e.tenantCode();
        UUID tripId = UUID.fromString(e.tripId());
        Optional<Trip> trip = trips.find(tenant, tripId);
        if (step == null || trip.isEmpty() || finished(trip.get())
                || milestones.list(tenant, tripId).stream().noneMatch(
                        x -> TripMilestone.CLOSURE.equals(x.milestone()) && x.isConfirmed())
                || !deliveries.reached(tenant, tripId, step)) {
            return;
        }
        String actor = "monitor:" + m.monitorKey() + "@v" + m.version();
        String from = running(trip.get());
        Map<String, Object> action = new LinkedHashMap<>();
        action.put("type", "completeTrip");
        action.put("rule", DELIVERY_RULE);
        String error = null;
        try {
            PgTx.savepoint(() -> {
                completeTrip(tenant, tripId, actor);
                return null;
            });
            action.put("result", "done");
        } catch (RuntimeException ex) {
            action.put("result", "failed");
            error = DELIVERY_RULE + ": " + message(ex);
        }
        Trip after = trips.find(tenant, tripId).orElse(trip.get());
        recordTransition(run, m, q, new TransitionResult(List.of(DELIVERY_RULE), DELIVERY_RULE, from,
                running(after), List.of(action), error));
    }

    private static final class RuleEffects {
        private final List<String> matched = new ArrayList<>();
        private final List<String> errors = new ArrayList<>();
        private final List<Map<String, Object>> actions = new ArrayList<>();
        private String stateRule;
    }

    private record TransitionResult(List<String> matched, String ruleKey, String from, String to,
            List<Map<String, Object>> actions, String error) {
    }

    private void evaluateRules(Run run, Queued q, Trip trip, TripMonitor monitor) {
        MonitorRun.Event event = q.event();
        List<TripMonitor.Rule> candidates = monitor.rules().stream()
                .filter(rule -> matchesTrigger(rule, event)).toList();
        if (candidates.isEmpty()) {
            return;
        }
        Map<String, Object> ctx = context.of(trip, event, monitor.params());
        String from = running(trip);
        String actor = "monitor:" + monitor.monitorKey() + "@v" + monitor.version();
        RuleEffects effects = new RuleEffects();
        for (TripMonitor.Rule rule : candidates) {
            if (holds(monitor, rule, ctx, effects.errors)) {
                effects.matched.add(rule.key());
                applyRule(run, monitor, trip, event, rule, actor, effects);
            }
        }
        if (effects.matched.isEmpty() && effects.errors.isEmpty()) {
            return;
        }
        Trip after = trips.find(trip.tenantCode(), UUID.fromString(trip.id())).orElse(trip);
        recordTransition(run, monitor, q, new TransitionResult(effects.matched, effects.stateRule, from,
                running(after), effects.actions, effects.errors.isEmpty() ? null : String.join("; ", effects.errors)));
    }

    private static boolean matchesTrigger(TripMonitor.Rule rule, MonitorRun.Event event) {
        return rule.active() && rule.on().equals(event.on())
                && (!TIMER.equals(event.on()) || rule.key().equals(event.kind()));
    }

    private void applyRule(Run run, TripMonitor monitor, Trip trip, MonitorRun.Event event, TripMonitor.Rule rule,
            String actor, RuleEffects effects) {
        List<TripMonitor.Action> stateActions = rule.then().stream()
                .filter(action -> STATE_ACTIONS.contains(action.type())).toList();
        if (!stateActions.isEmpty() && effects.stateRule == null) {
            effects.stateRule = rule.key();
            applyStateActions(run, trip, stateActions, actor, effects);
        }
        for (TripMonitor.Action action : rule.then()) {
            if (REQUEST_CONFIRMATION.equals(action.type())) {
                effects.actions.add(requestConfirmation(trip.tenantCode(), UUID.fromString(trip.id()), event,
                        action, rule.key(), actor, effects.errors));
            } else if (!STATE_ACTIONS.contains(action.type())) {
                effects.actions.add(action(action, rule.key(), "recorded"));
                if ("alert".equals(action.type())) {
                    publishAlert(run, monitor, event, UUID.fromString(trip.id()), action.value(), rule.key());
                }
            }
        }
    }

    private void applyStateActions(Run run, Trip trip, List<TripMonitor.Action> actions, String actor,
            RuleEffects effects) {
        int queued = run.queue.size();
        try {
            List<Map<String, Object>> applied = new ArrayList<>();
            PgTx.savepoint(() -> {
                for (TripMonitor.Action action : actions) {
                    applied.add(apply(trip.tenantCode(), UUID.fromString(trip.id()), action, actor));
                }
                return null;
            });
            effects.actions.addAll(applied);
        } catch (RuntimeException failure) {
            while (run.queue.size() > queued) {
                run.queue.pollLast();
            }
            effects.errors.add(effects.stateRule + ": " + message(failure));
        }
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
            // fields were checked on save: a missing key here is a value the trip does not have yet
            if (!MonitorLanguage.missingValue(result.error())) {
                errors.add(r.key() + ": " + result.error());
            }
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
            case START -> stages.start(tenant, actor, UUID.fromString(pending(tenant, tripId, v)
                    .orElseThrow(() -> new IllegalStateException("no pending " + v + " stage")).id()));
            case CLOSE -> stages.close(tenant, actor, UUID.fromString(running(tenant, tripId)
                    .filter(s -> s.stageType().equals(v))
                    .orElseThrow(() -> new IllegalStateException("the " + v + " stage is not in progress")).id()));
            case "completeTrip" -> completeTrip(tenant, tripId, actor);
            case "cancelTrip" -> tripService.cancel(tenant, actor, tripId, v);
            case CLOSE_MANDATES -> {
                return closeMandates(tenant, tripId, actor);
            }
            default -> throw new IllegalStateException("unknown action " + a.type());
        }
        return action(a, null, "done");
    }

    /**
     * Leaves the action's milestone pending with the event's time as the proposed one. A signal is a GPS detection
     * unless it names its source.
     */
    private Map<String, Object> requestConfirmation(String tenant, UUID tripId, MonitorRun.Event e,
            TripMonitor.Action a, String rule, String actor, List<String> errors) {
        String source = sourceOf(e);
        Map<String, Object> evidence = new LinkedHashMap<>(e.data());
        evidence.put("on", e.on());
        evidence.put("kind", e.kind());
        try {
            MilestoneService.Outcome outcome = PgTx.savepoint(() -> milestones.request(tenant, actor, tripId,
                    a.value(), source, e.at(), evidence, rule));
            return action(a, rule, outcome.result() == MilestoneService.Result.SKIPPED ? "skipped" : "pending");
        } catch (RuntimeException ex) {
            errors.add(rule + ": " + message(ex));
            return action(a, rule, "failed");
        }
    }

    /** An alert is published once per trip and key, the first time a rule raises it. */
    private void publishAlert(Run run, TripMonitor m, MonitorRun.Event e, UUID tripId, String key, String rule) {
        String tenant = e.tenantCode();
        if (!run.alerts.add(tripId + "|" + key) || runs.alerted(tenant, tripId, key)) {
            return;
        }
        events.alert(tenant, tripId.toString(), e.at().toInstant(), m.monitorKey() + "@v" + m.version(), key, rule);
    }

    private static String sourceOf(MonitorRun.Event e) {
        if (e.data().get(SOURCE) instanceof String named) {
            return named;
        }
        return "signal".equals(e.on()) ? "gps" : e.on();
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
        out.put("type", CLOSE_MANDATES);
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
        Optional<Trip> trip = trips.find(tenant, tripId);
        if (trip.isEmpty() || finished(trip.get())) {
            runs.dropPendingTimers(tenant, tripId);
            return;
        }
        List<MonitorRun.Timer> pending = runs.pendingTimers(tenant, tripId);
        int epoch = runs.nextEpoch(tenant, tripId);
        TripMonitor m = monitor(tenant, state.get().monitorKey(), state.get().monitorVersion()).orElse(null);
        List<TripMonitor.Rule> timers = m == null ? List.of()
                : m.rules().stream().filter(r -> r.active() && TIMER.equals(r.on())).toList();
        if (timers.isEmpty()) {
            runs.dropPendingTimers(tenant, tripId);
            return;
        }
        Map<String, Object> ctx = context.of(trip.get(), new MonitorRun.Event(tenant, tripId.toString(), TIMER, null,
                now(), "monitor:clock", Map.of()), m.params());
        for (TripMonitor.Rule r : timers) {
            MonitorLanguage.Result at = prepared(m, r, "at", r.at()).run(ctx);
            if (at.ok() && at.value() instanceof Instant i) {
                OffsetDateTime due = OffsetDateTime.ofInstant(i, ZoneOffset.UTC);
                if (!runs.fired(tenant, tripId, m.monitorKey(), m.version(), r.key(), due)) {
                    retainOrSchedule(tenant, tripId, m, r, due, epoch, pending);
                }
            }
        }
        runs.dropObsoleteTimers(tenant, tripId, epoch);
    }

    private void retainOrSchedule(String tenant, UUID tripId, TripMonitor monitor, TripMonitor.Rule rule,
            OffsetDateTime due, int epoch, List<MonitorRun.Timer> pending) {
        Optional<MonitorRun.Timer> existing = pending.stream()
                .filter(t -> t.ruleKey().equals(rule.key()) && t.monitorVersion() == monitor.version()
                        && t.dueAt().isEqual(due)).findFirst();
        if (existing.isPresent()) {
            runs.retainTimer(existing.get().id(), epoch);
        } else {
            runs.schedule(tenant, tripId, rule.key(), monitor.version(), due, epoch);
        }
    }

    /**
     * A new trip gets the monitor it asked for, or the selector's; empty when neither gives one. A regularized trip
     * gets none: it is recorded after it ran.
     */
    private Optional<MonitorRun.State> bindNew(Trip trip, MonitorRun.Event e) {
        if (Boolean.TRUE.equals(e.data().get(REGULARIZED))) {
            return Optional.empty();
        }
        String tenant = trip.tenantCode();
        Object asked = e.data().get(MONITOR);
        String key = asked instanceof String s ? s : select(trip).orElse(null);
        if (key == null) {
            return Optional.empty();
        }
        Optional<TripMonitor> m = newest(tenant, key);
        if (m.isEmpty()) {
            LOG.warnf("Trip %s asked for monitor %s, which has no published version", trip.id(), key);
            return Optional.empty();
        }
        UUID tripId = UUID.fromString(trip.id());
        MonitorRun.State state = runs.bind(tenant, tripId, key, m.get().version(), e.actor());
        if (stageStore.listBySubject(tenant, Stage.SUBJECT_TRIP, tripId).isEmpty()) {
            for (TripMonitor.StagePlan planned : m.get().plan()) {
                stages.add(tenant, e.actor(), tripId, new StageRequest(planned.stageType(),
                        planned.serviceStatus(), null, null, null, null));
            }
        }
        audit.log(tenant, e.actor(), "monitor.bound", "trip", trip.id(), null,
                Map.of(MONITOR, key, "version", m.get().version()));
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

    private void recordTransition(Run run, TripMonitor m, Queued queued, TransitionResult result) {
        MonitorRun.Event e = queued.event();
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("on", e.on());
        event.put("kind", e.kind());
        event.put("at", e.at().toString());
        event.put("actor", e.actor());
        if (!e.data().isEmpty()) {
            event.put("data", e.data());
        }
        MonitorRun.Transition t = new MonitorRun.Transition(0, e.tenantCode(), e.tripId(), m.monitorKey(),
                m.version(), event, queued.depth(), result.matched(), result.ruleKey(), result.from(), result.to(),
                result.actions(), result.error(), e.at(), null);
        runs.recordTransition(t);
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
        if (MilestoneService.CONFIRMED.equals(action) || MilestoneService.REJECTED.equals(action)) {
            return milestoneEvent(tenant, actor, action, tripId, d, at);
        }
        if (DeliveryService.STEP_CONFIRMED.equals(action) || DeliveryService.STEP_REJECTED.equals(action)) {
            return deliveryEvent(tenant, actor, action, tripId, d, at);
        }
        String[] onKind = switch (action) {
            case "trip.created" -> new String[] {"plan", "created"};
            case "trip.updated", "trip.cancelled" -> new String[] {"plan", "trip"};
            case "trip.mandate_linked", "trip.mandate_unlinked" -> new String[] {"plan", "mandates"};
            case "stage.added", "stage.updated" -> new String[] {"plan", "stages"};
            case "assignment.created", "assignment.ended" -> new String[] {"plan", "resources"};
            case "stage.started" -> new String[] {STAGE, "started"};
            case "stage.closed" -> new String[] {STAGE, "closed"};
            default -> action.startsWith("trip_cargo.") ? new String[] {"plan", "cargo"} : null;
        };
        if (onKind == null) {
            return null;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        if (d.get(STAGE_TYPE) != null) {
            data.put(STAGE_TYPE, d.get(STAGE_TYPE));
        }
        if (d.get(MONITOR) != null) {
            data.put(MONITOR, d.get(MONITOR));
        }
        if (Boolean.TRUE.equals(d.get(REGULARIZED))) {
            data.put(REGULARIZED, true);
        }
        return new MonitorRun.Event(tenant, tripId, onKind[0], onKind[1], at, actor, data);
    }

    /** A milestone confirmed or rejected, at the time the person gave. */
    private static MonitorRun.Event milestoneEvent(String tenant, String actor, String action, String tripId,
            Map<String, Object> d, OffsetDateTime now) {
        Object milestone = d.get("milestone");
        if (!(milestone instanceof String m)) {
            return null;
        }
        String kind = m + (MilestoneService.CONFIRMED.equals(action) ? "_confirmed" : "_rejected");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("milestone", m);
        for (String key : List.of("channel", SOURCE)) {
            if (d.get(key) != null) {
                data.put(key, d.get(key));
            }
        }
        OffsetDateTime at = d.get("at") instanceof String text ? OffsetDateTime.parse(text) : now;
        return new MonitorRun.Event(tenant, tripId, COMMAND, kind, at, actor, data);
    }

    /** A delivery step confirmed or rejected: {@code delivery_<step>_confirmed} or {@code _rejected}. */
    private static MonitorRun.Event deliveryEvent(String tenant, String actor, String action, String tripId,
            Map<String, Object> d, OffsetDateTime now) {
        if (!(d.get("step") instanceof String step)) {
            return null;
        }
        String kind = DELIVERY_PREFIX + step
                + (DeliveryService.STEP_CONFIRMED.equals(action) ? CONFIRMED_SUFFIX : "_rejected");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("step", step);
        for (String key : List.of("delivery", "channel")) {
            if (d.get(key) != null) {
                data.put(key, d.get(key));
            }
        }
        OffsetDateTime at = d.get("at") instanceof String text ? OffsetDateTime.parse(text) : now;
        return new MonitorRun.Event(tenant, tripId, COMMAND, kind, at, actor, data);
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
