package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.DeliveryCycle;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.MonitorScope;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.dto.MonitorViews;
import com.microboxlabs.miot.trips.dto.MonitorViews.Finding;
import com.microboxlabs.miot.trips.monitor.MonitorLanguage;
import com.microboxlabs.miot.trips.monitor.MonitorLanguage.Expect;
import com.microboxlabs.miot.trips.monitor.MonitorSchema;
import com.microboxlabs.miot.trips.store.FeedStore;
import com.microboxlabs.miot.trips.store.LocationStore;
import com.microboxlabs.miot.trips.store.MonitorStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

/**
 * Trip monitors: drafts and versions. A draft saves when its structure is valid; problems in its expressions, a
 * missing scope and a scope that duplicates another monitor's block publishing. Running the rules on trips is not
 * done here.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class MonitorService {

    private static final String SCOPE_LOCK = "_scope";
    private static final String TIMER = "timer";
    static final String ENTITY = "monitor";
    private static final String KEY_PATTERN = "[a-z0-9][a-z0-9-]*";
    private static final String PARAM_PATTERN = "[A-Za-z]\\w*";
    private static final String NOT_FOUND = "monitor not found";
    private static final int DEFAULT_PRIORITY = 100;
    private static final int MAX_RULES = 100;
    private static final int MAX_SCOPE_VALUES = 200;
    private static final int MAX_LOCATIONS = 1000;
    private static final int MAX_EXPRESSION = 4000;

    private static final Set<String> STAGE_ACTIONS = Set.of("advance", "start", "close");
    private static final Set<String> FLAG_ACTIONS = Set.of("completeTrip", "closeMandates");
    private static final Set<String> NAMED_ACTIONS = Set.of("cancelTrip", "alert", "invoke");
    private static final String REQUEST_CONFIRMATION = "requestConfirmation";
    private static final String RULE = "rule ";

    private final MonitorStore store;
    private final FeedStore feeds;
    private final LocationStore locations;
    private final AuditService audit;
    private final Transactions tx;

    @Inject
    public MonitorService(MonitorStore store, FeedStore feeds, LocationStore locations, AuditService audit,
            Transactions tx) {
        this.store = store;
        this.feeds = feeds;
        this.locations = locations;
        this.audit = audit;
        this.tx = tx;
    }

    public List<MonitorViews.Summary> list(String tenantCode) {
        Map<String, List<TripMonitor>> byKey = new LinkedHashMap<>();
        for (TripMonitor m : store.all(tenantCode)) {
            byKey.computeIfAbsent(m.monitorKey(), k -> new ArrayList<>()).add(m);
        }
        return byKey.values().stream().map(versions -> {
            TripMonitor newest = versions.get(0);
            Integer published = versions.stream().filter(v -> TripMonitor.PUBLISHED.equals(v.status()))
                    .map(TripMonitor::version).findFirst().orElse(null);
            Integer draft = TripMonitor.DRAFT.equals(newest.status()) ? newest.version() : null;
            return new MonitorViews.Summary(newest.monitorKey(), newest.name(), newest.description(), published,
                    draft, newest.rules().size(), newest.scope(), newest.updatedAt(), newest.updatedBy());
        }).toList();
    }

    public MonitorViews.Detail get(String tenantCode, String monitorKey) {
        List<TripMonitor> versions = store.versions(tenantCode, monitorKey);
        if (versions.isEmpty()) {
            throw new NoSuchElementException(NOT_FOUND);
        }
        TripMonitor draft = versions.stream().filter(v -> TripMonitor.DRAFT.equals(v.status())).findFirst()
                .orElse(null);
        TripMonitor published = versions.stream().filter(v -> TripMonitor.PUBLISHED.equals(v.status()))
                .findFirst().orElse(null);
        return new MonitorViews.Detail(monitorKey, draft == null ? null : view(draft),
                published == null ? null : view(published),
                versions.stream().map(MonitorViews.Version::of).toList());
    }

    public MonitorViews.Monitor version(String tenantCode, String monitorKey, int version) {
        return view(store.version(tenantCode, monitorKey, version)
                .orElseThrow(() -> new NoSuchElementException(NOT_FOUND)));
    }

    /** Creates or replaces the draft. */
    public MonitorViews.Monitor saveDraft(String tenantCode, String actor, String monitorKey, MonitorRequest body) {
        String key = key(monitorKey);
        if (body == null) {
            throw new IllegalArgumentException("body is required");
        }
        TripMonitor draft = new TripMonitor(tenantCode, key, 0, TripMonitor.DRAFT, Check.required(body.name(),
                "name", 255), Check.limitedOrNull(body.description(), "description", 2000), plan(body.plan()),
                params(body.params()), rules(body.rules()), scope(body.scope()), null, actor, null, actor, null,
                null);
        return tx.inTransaction(() -> {
            store.lock(tenantCode, key);
            TripMonitor saved = store.saveDraft(draft);
            audit.log(tenantCode, actor, "monitor.draft_saved", ENTITY, key, null,
                    Map.of("version", String.valueOf(saved.version())));
            return view(saved);
        });
    }

    /** Publishes the draft as a new version; refused while it has findings or its scope duplicates another's. */
    public MonitorViews.Monitor publish(String tenantCode, String actor, String monitorKey) {
        return tx.inTransaction(() -> {
            store.lock(tenantCode, SCOPE_LOCK);
            store.lock(tenantCode, monitorKey);
            TripMonitor draft = store.versions(tenantCode, monitorKey).stream()
                    .filter(v -> TripMonitor.DRAFT.equals(v.status())).findFirst()
                    .orElseThrow(() -> new NoSuchElementException("the monitor has no draft"));
            List<Finding> findings = findings(draft);
            if (!findings.isEmpty()) {
                Finding f = findings.get(0);
                String where = f.ruleKey() == null ? f.field() : RULE + f.ruleKey() + " (" + f.field() + ")";
                throw new IllegalArgumentException(where + ": " + f.message()
                        + (findings.size() > 1 ? " and " + (findings.size() - 1) + " more" : ""));
            }
            List<String> duplicates = overlaps(tenantCode, monitorKey, draft.scope()).stream()
                    .filter(o -> o.relation() == MonitorScope.Relation.DUPLICATE)
                    .map(MonitorViews.Overlap::name).toList();
            if (!duplicates.isEmpty()) {
                throw new IllegalArgumentException("scope: duplicates the trips of " + duplicates);
            }
            TripMonitor published = store.publish(tenantCode, monitorKey, actor).orElseThrow();
            audit.log(tenantCode, actor, "monitor.published", ENTITY, monitorKey, null,
                    Map.of("version", String.valueOf(published.version())));
            return view(published);
        });
    }

    public void discardDraft(String tenantCode, String actor, String monitorKey) {
        tx.inTransaction(() -> {
            store.lock(tenantCode, monitorKey);
            if (!store.deleteDraft(tenantCode, monitorKey)) {
                throw new NoSuchElementException("the monitor has no draft");
            }
            audit.log(tenantCode, actor, "monitor.draft_discarded", ENTITY, monitorKey, null, Map.of());
            return null;
        });
    }

    /** What an expression of a rule triggered by {@code on} may read. */
    public List<MonitorViews.Field> schema(String on, Map<String, Object> params) {
        MonitorSchema schema = MonitorSchema.of(trigger(on), params(params));
        List<MonitorViews.Field> fields = new ArrayList<>();
        schema.fields().forEach((path, type) -> fields.add(new MonitorViews.Field(path, type)));
        for (String dynamic : MonitorSchema.DYNAMIC) {
            fields.add(new MonitorViews.Field(dynamic, "any"));
        }
        return fields;
    }

    /** Checks one expression while it is typed. */
    public MonitorViews.CheckResult check(MonitorViews.CheckRequest body) {
        if (body == null) {
            throw new IllegalArgumentException("body is required");
        }
        Expect expect = "time".equals(body.expect()) ? Expect.TIME : Expect.CONDITION;
        MonitorSchema schema = MonitorSchema.of(trigger(body.on()), params(body.params()));
        MonitorLanguage.Check c = MonitorLanguage.check(schema, body.expression(), expect);
        return new MonitorViews.CheckResult(c.ok(), c.resultType(), c.issues().stream()
                .map(i -> new Finding(null, expect == Expect.TIME ? "at" : "when", i.position(), i.message()))
                .toList());
    }

    /** How the scope stands to the published scope of every other monitor it meets. */
    public MonitorViews.ScopeCheck checkScope(String tenantCode, String monitorKey,
            MonitorViews.ScopeCheckRequest body) {
        MonitorScope scope = scope(body == null ? null : body.scope());
        return new MonitorViews.ScopeCheck(scope == null ? List.of() : overlaps(tenantCode, monitorKey, scope));
    }

    /** The feeds, order types and locations a scope can name. */
    public MonitorViews.ScopeValues scopeValues(String tenantCode) {
        List<MonitorViews.ScopeValues.Place> places = new ArrayList<>();
        int page = 0;
        List<Location> batch;
        do {
            batch = locations.list(tenantCode, null, null, page++, MAX_LOCATIONS);
            batch.stream().map(l -> new MonitorViews.ScopeValues.Place(l.id(), l.name(), l.externalCode(),
                    l.type())).forEach(places::add);
        } while (batch.size() == MAX_LOCATIONS);
        return new MonitorViews.ScopeValues(
                feeds.profiles(tenantCode).stream()
                        .map(p -> new MonitorViews.ScopeValues.Feed(p.feedKey(), p.name())).toList(),
                store.orderTypes(tenantCode), places);
    }

    /** Of {@code all} versions, the newest published one of every monitor that has a scope, but {@code except}. */
    static List<TripMonitor> scoped(List<TripMonitor> all, String except) {
        Map<String, TripMonitor> newest = new LinkedHashMap<>();
        for (TripMonitor m : all) {
            if (TripMonitor.PUBLISHED.equals(m.status()) && !m.monitorKey().equals(except)) {
                newest.putIfAbsent(m.monitorKey(), m);
            }
        }
        return newest.values().stream().filter(m -> m.scope() != null).toList();
    }

    private List<MonitorViews.Overlap> overlaps(String tenantCode, String monitorKey, MonitorScope scope) {
        List<MonitorViews.Overlap> out = new ArrayList<>();
        for (TripMonitor other : scoped(store.all(tenantCode), monitorKey)) {
            MonitorScope.Relation r = scope.relationTo(other.scope());
            if (r != MonitorScope.Relation.DISJOINT) {
                out.add(new MonitorViews.Overlap(other.monitorKey(), other.name(), r));
            }
        }
        return out;
    }

    /** The problems in the monitor's expressions, by rule. */
    static List<Finding> findings(TripMonitor m) {
        List<Finding> out = new ArrayList<>();
        if (m.scope() == null) {
            out.add(new Finding(null, "scope", 0, "choose the trips the monitor takes"));
        }
        Set<String> planned = new HashSet<>();
        m.plan().forEach(p -> planned.add(p.stageType()));
        for (TripMonitor.Rule r : m.rules()) {
            MonitorSchema schema = MonitorSchema.of(r.on(), m.params());
            if (r.when() != null && !r.when().isBlank()) {
                MonitorLanguage.check(schema, r.when(), Expect.CONDITION).issues()
                        .forEach(i -> out.add(new Finding(r.key(), "when", i.position(), i.message())));
            }
            if (TIMER.equals(r.on())) {
                MonitorLanguage.check(schema, r.at(), Expect.TIME).issues()
                        .forEach(i -> out.add(new Finding(r.key(), "at", i.position(), i.message())));
            }
            for (TripMonitor.Action a : r.then()) {
                if (STAGE_ACTIONS.contains(a.type()) && !planned.isEmpty() && !planned.contains(a.value())) {
                    out.add(new Finding(r.key(), "then", 0, "stage " + a.value() + " is not in the plan"));
                }
            }
        }
        return out;
    }

    private static MonitorViews.Monitor view(TripMonitor m) {
        return MonitorViews.Monitor.of(m, findings(m));
    }

    private static String key(String monitorKey) {
        String key = Check.required(monitorKey, "monitorKey", 64);
        if (!key.matches(KEY_PATTERN)) {
            throw new IllegalArgumentException("monitorKey must be lowercase letters, digits and dashes");
        }
        return key;
    }

    /** Null stays null: the monitor takes no trips yet. */
    private static MonitorScope scope(MonitorScope scope) {
        if (scope == null) {
            return null;
        }
        limitScope("feeds", scope.feeds(), 64);
        limitScope("orderTypes", scope.orderTypes(), 32);
        limitScope("origins", scope.origins(), 36);
        limitScope("destinations", scope.destinations(), 36);
        return new MonitorScope(scope.feeds(), scope.orderTypes(), canonicalLocations(scope.origins()),
                canonicalLocations(scope.destinations()));
    }

    private static List<String> canonicalLocations(List<String> places) {
        List<String> normalized = new ArrayList<>();
        for (String id : places) {
            try {
                normalized.add(UUID.fromString(id).toString());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("scope: " + id + " is not a location id");
            }
        }
        return normalized;
    }

    private static void limitScope(String dimension, List<String> values, int length) {
        if (values.size() > MAX_SCOPE_VALUES) {
            throw new IllegalArgumentException("scope: " + dimension + " holds at most " + MAX_SCOPE_VALUES
                    + " values");
        }
        values.forEach(v -> Check.limited(v, "scope " + dimension, length));
    }

    private static String trigger(String on) {
        return Check.oneOf(Check.required(on, "on", 16), "on", MonitorSchema.TRIGGERS.toArray(String[]::new));
    }

    private static List<TripMonitor.StagePlan> plan(List<TripMonitor.StagePlan> plan) {
        if (plan == null) {
            return List.of();
        }
        Set<String> types = new LinkedHashSet<>();
        List<TripMonitor.StagePlan> normalized = new ArrayList<>();
        for (TripMonitor.StagePlan s : plan) {
            String type = Check.oneOf(Check.required(s == null ? null : s.stageType(), "stageType", 32),
                    "stageType", MonitorSchema.STAGE_TYPES.toArray(String[]::new));
            if (!types.add(type)) {
                throw new IllegalArgumentException("stage " + type + " is listed twice in the plan");
            }
            normalized.add(new TripMonitor.StagePlan(type,
                    Check.limitedOrNull(s.serviceStatus(), "serviceStatus", 64)));
        }
        return List.copyOf(normalized);
    }

    /** Parameters are named like identifiers and hold a number, a yes/no or a text. */
    private static Map<String, Object> params(Map<String, Object> params) {
        if (params == null) {
            return Map.of();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        params.forEach((name, value) -> {
            if (name == null || !name.matches(PARAM_PATTERN) || name.length() > 64) {
                throw new IllegalArgumentException("parameter " + name + " must be a letter followed by letters,"
                        + " digits or _");
            }
            if (!(value instanceof Number || value instanceof Boolean || value instanceof String)) {
                throw new IllegalArgumentException("parameter " + name + " must be a number, true/false or a text");
            }
            out.put(name, value);
        });
        DeliveryCycle.of(out);
        return out;
    }

    private static List<TripMonitor.Rule> rules(List<MonitorRequest.Rule> rules) {
        if (rules == null) {
            return List.of();
        }
        if (rules.size() > MAX_RULES) {
            throw new IllegalArgumentException("a monitor holds at most " + MAX_RULES + " rules");
        }
        Set<String> keys = new HashSet<>();
        List<TripMonitor.Rule> out = new ArrayList<>();
        for (MonitorRequest.Rule r : rules) {
            out.add(normalizeRule(r, keys));
        }
        out.sort(Comparator.comparingInt(TripMonitor.Rule::priority));
        return List.copyOf(out);
    }

    private static TripMonitor.Rule normalizeRule(MonitorRequest.Rule r, Set<String> keys) {
        if (r == null) {
            throw new IllegalArgumentException("a rule is empty");
        }
        String key = Check.required(r.key(), "rule key", 64);
        if (!key.matches(KEY_PATTERN)) {
            throw new IllegalArgumentException("rule key " + key + " must be lowercase letters, digits and dashes");
        }
        if (!keys.add(key)) {
            throw new IllegalArgumentException(RULE + key + " is listed twice");
        }
        String on = trigger(r.on());
        String at = Check.limitedOrNull(r.at(), "at", MAX_EXPRESSION);
        if (TIMER.equals(on) && at == null) {
            throw new IllegalArgumentException(RULE + key + ": a timer rule needs at");
        }
        if (!TIMER.equals(on) && at != null) {
            throw new IllegalArgumentException(RULE + key + ": only a timer rule has at");
        }
        return new TripMonitor.Rule(key, Check.limitedOrNull(r.name(), "rule name", 255), on, at,
                Check.limitedOrNull(r.when(), "when", MAX_EXPRESSION), actions(key, r.then()),
                r.priority() == null ? DEFAULT_PRIORITY : r.priority(), r.active() == null || r.active());
    }

    private static List<TripMonitor.Action> actions(String rule, List<TripMonitor.Action> then) {
        if (then == null || then.isEmpty()) {
            throw new IllegalArgumentException(RULE + rule + " has no actions");
        }
        List<TripMonitor.Action> out = new ArrayList<>();
        for (TripMonitor.Action a : then) {
            String type = Check.required(a == null ? null : a.type(), "action type", 32);
            String value = a == null ? null : Check.blankToNull(a.value());
            if (STAGE_ACTIONS.contains(type)) {
                Check.oneOf(value, RULE + rule + ": " + type, MonitorSchema.STAGE_TYPES.toArray(String[]::new));
            } else if (FLAG_ACTIONS.contains(type)) {
                value = null;
            } else if (REQUEST_CONFIRMATION.equals(type)) {
                Check.oneOf(value, RULE + rule + ": " + type, MonitorSchema.MILESTONES.toArray(String[]::new));
            } else if (NAMED_ACTIONS.contains(type)) {
                Check.required(value, RULE + rule + ": " + type, 255);
            } else {
                throw new IllegalArgumentException(RULE + rule + ": unknown action " + type);
            }
            out.add(new TripMonitor.Action(type, value == null ? null : value.trim()));
        }
        return List.copyOf(out);
    }
}
