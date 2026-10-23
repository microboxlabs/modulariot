package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Step;
import com.microboxlabs.miot.conversational.rules.RuleSpecValidator.Finding;
import com.microboxlabs.miot.conversational.rules.store.RuleStore;
import com.microboxlabs.miot.conversational.rules.store.RunStore;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import com.microboxlabs.miot.core.event.EventTypeCatalog;
import com.microboxlabs.miot.core.event.Participant;
import com.microboxlabs.miot.core.event.ParticipantResolver;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * What the Comunicaciones settings read and change: rules and their drafts, templates, the event catalog, a
 * simulation of a rule on a sample event, and the runs. Unknown ids are {@link NoSuchElementException}, bad
 * input {@link IllegalArgumentException}, a conflict {@link IllegalStateException}.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class RulesService {

    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9_-]{0,127}");
    private static final Pattern SYMPTOM_KEY = Pattern.compile("event\\.data\\.symptomKey\\s*==\\s*['\"]([^'\"]+)['\"]");
    static final int DEFAULT_LIMIT = 50;
    static final int MAX_LIMIT = 200;
    private static final String RULE_NOT_FOUND = "Rule not found";

    public record TriggerView(String event, String when) {
    }

    public record RuleSummary(String id, String key, String name, Rule.State state, Integer currentVersion,
            boolean hasDraft, TriggerView trigger, int stepsCount, List<String> channels, String symptomKey) {
    }

    public record RuleDetail(Rule rule, RuleVersion current, RuleVersion draft, List<RuleVersion> versions) {
    }

    public record DraftResult(RuleVersion draft, List<Finding> findings) {
    }

    public record RuleRef(String id, String key, String name, Rule.State state) {
    }

    public record TemplateView(String id, String key, String name, String baseText, ConvTemplate.WhatsApp whatsapp,
            ConvTemplate.Email email, Instant updatedAt, String updatedBy, List<RuleRef> usedBy) {
    }

    public record TemplateRequest(String name, String baseText, ConvTemplate.WhatsApp whatsapp,
            ConvTemplate.Email email) {
    }

    public record SampleContext(String kind, String key) {
    }

    public record SampleEvent(String type, SampleContext context, Map<String, Object> data, boolean test,
            Instant at) {
    }

    public record Recipient(String address, String channel, String name, String role) {
    }

    public record To(String address, String channel, String name) {
    }

    public record SimulatedMessage(int step, Instant at, String channel, To to, String text) {
    }

    public record Simulation(boolean matches, List<Recipient> recipients, List<SimulatedMessage> messages,
            List<Finding> findings) {
    }

    public record RunMessageView(String id, Integer step, String channel, String to, String toName, String status,
            String text, Instant at) {
    }

    public record RunView(String id, String ruleId, String ruleName, int ruleVersion, String eventId,
            String eventType, String contextKind, String contextKey, boolean test, Run.Status status, int step,
            Instant nextAt, String lastError, Instant createdAt, Instant updatedAt, List<RunMessageView> messages) {
    }

    /** Publishing refused because the draft has errors. */
    public static final class NotPublishable extends RuntimeException {
        private final transient List<Finding> findings;

        NotPublishable(List<Finding> findings) {
            super("La versión tiene errores");
            this.findings = List.copyOf(findings);
        }

        public List<Finding> findings() {
            return findings;
        }
    }

    private final RuleStore rules;
    private final TemplateStore templates;
    private final RunStore runs;
    private final Supplier<List<EventTypeCatalog>> catalogs;
    private final Supplier<List<ParticipantResolver>> resolvers;
    private final Clock clock;

    @Inject
    RulesService(RuleStore rules, TemplateStore templates, RunStore runs, Instance<EventTypeCatalog> catalogs,
            Instance<ParticipantResolver> resolvers) {
        this(rules, templates, runs, () -> catalogs.stream().toList(), () -> resolvers.stream().toList(),
                Clock.systemUTC());
    }

    public RulesService(RuleStore rules, TemplateStore templates, RunStore runs,
            Supplier<List<EventTypeCatalog>> catalogs, Supplier<List<ParticipantResolver>> resolvers, Clock clock) {
        this.rules = rules;
        this.templates = templates;
        this.runs = runs;
        this.catalogs = catalogs;
        this.resolvers = resolvers;
        this.clock = clock;
    }

    // Rules

    public List<RuleSummary> list(String tenantCode) {
        List<RuleSummary> out = new ArrayList<>();
        for (Rule r : rules.list(tenantCode)) {
            List<RuleVersion> versions = rules.versions(r.id());
            RuleVersion draft = draft(versions);
            RuleVersion shown = current(r, versions) != null ? current(r, versions) : draft;
            RuleSpec spec = RuleSpec.read(shown == null ? null : shown.spec());
            TriggerView trigger = spec.trigger() == null ? null
                    : new TriggerView(spec.trigger().event(), spec.trigger().when());
            out.add(new RuleSummary(r.id(), r.key(), r.name(), r.state(), r.currentVersion(), draft != null, trigger,
                    spec.steps().size(), spec.channels(), symptomKey(spec)));
        }
        return out;
    }

    public RuleDetail create(String tenantCode, String key, String name, JsonNode spec, String actor) {
        if (key == null || !KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("key: letras minúsculas, números, - y _ (hasta 128)");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        Instant now = clock.instant();
        Rule rule = rules.create(new Rule(UUID.randomUUID().toString(), tenantCode, key, name.trim(), Rule.State.OFF,
                null, now, now));
        rules.saveDraft(rule.id(), spec == null || spec.isNull() ? RuleSpec.empty() : spec, actor, now);
        return detail(tenantCode, rule.id());
    }

    public RuleDetail detail(String tenantCode, String id) {
        Rule rule = rule(tenantCode, id);
        List<RuleVersion> versions = rules.versions(rule.id());
        return new RuleDetail(rule, current(rule, versions), draft(versions),
                versions.stream().filter(v -> v.status() == RuleVersion.Status.PUBLISHED).toList());
    }

    public DraftResult saveDraft(String tenantCode, String id, JsonNode spec, String actor) {
        if (spec == null || !spec.isObject()) {
            throw new IllegalArgumentException("spec must be an object");
        }
        Rule rule = rule(tenantCode, id);
        RuleVersion draft = rules.saveDraft(rule.id(), spec, actor, clock.instant());
        return new DraftResult(draft, validate(tenantCode, RuleSpec.read(spec)));
    }

    public RuleVersion publish(String tenantCode, String id, String reason, String actor) {
        Rule rule = rule(tenantCode, id);
        RuleVersion draft = draft(rules.versions(rule.id()));
        if (draft == null) {
            throw new IllegalStateException("La regla no tiene borrador");
        }
        List<Finding> findings = validate(tenantCode, RuleSpec.read(draft.spec()));
        if (!RuleSpecValidator.publishable(findings)) {
            throw new NotPublishable(findings);
        }
        return rules.publish(rule.id(), reason, actor, clock.instant())
                .orElseThrow(() -> new IllegalStateException("La regla no tiene borrador"));
    }

    public Rule setState(String tenantCode, String id, Rule.State state) {
        if (state == null) {
            throw new IllegalArgumentException("state is required: OFF, TEST or ACTIVE");
        }
        Rule rule = rule(tenantCode, id);
        if (state != Rule.State.OFF && rule.currentVersion() == null) {
            throw new IllegalStateException("Publica la regla antes de encenderla");
        }
        return rules.updateState(tenantCode, rule.id(), state, clock.instant())
                .orElseThrow(() -> new NoSuchElementException(RULE_NOT_FOUND));
    }

    public List<Finding> validate(String tenantCode, RuleSpec spec) {
        Map<String, ConvTemplate> byKey = new LinkedHashMap<>();
        templates.list(tenantCode).forEach(t -> byKey.put(t.key(), t));
        Audiences audiences = new Audiences(resolvers.get());
        return RuleSpecValidator.validate(spec, new RuleSpecValidator.Context(catalog().contextKinds(), byKey,
                kind -> audiences.roles(tenantCode, kind)));
    }

    /**
     * Runs the draft (else the version in force) on a sample event without storing or sending anything: whether
     * it matches, who would get messages, and each message at its time when nobody replies.
     */
    public Simulation simulate(String tenantCode, String id, SampleEvent sample) {
        if (sample == null || sample.type() == null) {
            throw new IllegalArgumentException("event.type is required");
        }
        Rule rule = rule(tenantCode, id);
        List<RuleVersion> versions = rules.versions(rule.id());
        RuleVersion version = draft(versions) != null ? draft(versions) : current(rule, versions);
        RuleSpec spec = RuleSpec.read(version == null ? null : version.spec());
        Instant at = sample.at() != null ? sample.at() : clock.instant();
        StoredEvent event = new StoredEvent("simulation", tenantCode, sample.type(), "simulation",
                sample.context() == null ? null : sample.context().kind(),
                sample.context() == null ? null : sample.context().key(), sample.data(), sample.test(), at, at);
        List<Finding> findings = validate(tenantCode, spec);
        if (!RulesEngine.matches(spec, event)) {
            return new Simulation(false, List.of(), List.of(), findings);
        }
        Audiences audiences = new Audiences(resolvers.get());
        Map<String, Recipient> recipients = new LinkedHashMap<>();
        List<SimulatedMessage> messages = new ArrayList<>();
        List<Step> steps = spec.steps();
        Instant t = steps.isEmpty() ? at : at.plus(Duration.ofMinutes(steps.get(0).afterMinutes()));
        for (int i = 0; i < steps.size(); i++) {
            Step step = steps.get(i);
            Optional<ConvTemplate> template = step.template() == null ? Optional.empty()
                    : templates.find(tenantCode, step.template());
            StepMessages.Plan plan = StepMessages.plan(step, spec, event, template, audiences);
            for (Participant p : plan.recipients()) {
                recipients.putIfAbsent(p.channel() + ":" + p.address(),
                        new Recipient(p.address(), p.channel(), p.name(), p.role()));
            }
            for (StepMessages.Planned m : plan.messages()) {
                messages.add(new SimulatedMessage(i, t, m.channel(),
                        new To(m.to().address(), m.to().channel(), m.to().name()), m.text()));
            }
            int after = i + 1 < steps.size() ? steps.get(i + 1).afterMinutes() : 0;
            t = t.plus(Duration.ofMinutes((long) step.waitMinutes() + after));
        }
        return new Simulation(true, List.copyOf(recipients.values()), messages, findings);
    }

    // Templates

    public List<TemplateView> templates(String tenantCode) {
        List<Usage> usage = usage(tenantCode);
        return templates.list(tenantCode).stream().map(t -> view(t, usage)).toList();
    }

    public TemplateView template(String tenantCode, String key) {
        ConvTemplate t = templates.find(tenantCode, key)
                .orElseThrow(() -> new NoSuchElementException("Template not found"));
        return view(t, usage(tenantCode));
    }

    public TemplateView saveTemplate(String tenantCode, String key, TemplateRequest body, String actor) {
        if (key == null || !KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("key: letras minúsculas, números, - y _ (hasta 128)");
        }
        if (body == null || body.name() == null || body.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (body.whatsapp() != null && (body.whatsapp().metaName() == null || body.whatsapp().metaName().isBlank())) {
            throw new IllegalArgumentException("whatsapp.metaName is required");
        }
        if (body.email() != null && (blank(body.email().subject()) || blank(body.email().body()))) {
            throw new IllegalArgumentException("email.subject and email.body are required");
        }
        Instant now = clock.instant();
        Optional<ConvTemplate> existing = templates.find(tenantCode, key);
        ConvTemplate saved = templates.upsert(new ConvTemplate(
                existing.map(ConvTemplate::id).orElse(UUID.randomUUID().toString()), tenantCode, key,
                body.name().trim(), body.baseText(), body.whatsapp(), body.email(),
                existing.map(ConvTemplate::createdAt).orElse(now), now, actor));
        return view(saved, usage(tenantCode));
    }

    // Catalog and runs

    public List<EventCatalog.EventTypeView> events() {
        return catalog().types();
    }

    public List<RunView> runs(String tenantCode, String ruleId, Run.Status status, Integer limit) {
        int n = limit == null || limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        List<RunStore.RunRow> rows = runs.list(tenantCode, ruleId, status, n);
        Map<String, List<RunMessageView>> byRun = new LinkedHashMap<>();
        for (RunStore.RunMessage m : runs.messages(rows.stream().map(r -> r.run().id()).toList())) {
            byRun.computeIfAbsent(m.runId(), k -> new ArrayList<>()).add(new RunMessageView(m.id(), m.step(),
                    m.channel(), m.to(), m.toName(), m.status(), m.text(), m.at()));
        }
        return rows.stream().map(row -> {
            Run r = row.run();
            return new RunView(r.id(), r.ruleId(), row.ruleName(), r.ruleVersion(), r.eventId(), row.eventType(),
                    r.contextKind(), r.contextKey(), r.test(), r.status(), r.step(), r.nextAt(), r.lastError(),
                    r.createdAt(), r.updatedAt(), byRun.getOrDefault(r.id(), List.of()));
        }).toList();
    }

    private EventCatalog catalog() {
        return new EventCatalog(catalogs.get());
    }

    private Rule rule(String tenantCode, String id) {
        return rules.find(tenantCode, id).orElseThrow(() -> new NoSuchElementException(RULE_NOT_FOUND));
    }

    private static RuleVersion draft(List<RuleVersion> versions) {
        return versions.stream().filter(v -> v.status() == RuleVersion.Status.DRAFT).findFirst().orElse(null);
    }

    private static RuleVersion current(Rule rule, List<RuleVersion> versions) {
        if (rule.currentVersion() == null) {
            return null;
        }
        return versions.stream().filter(v -> rule.currentVersion().equals(v.version())).findFirst().orElse(null);
    }

    /** The symptom key in {@code event.data.symptomKey == '<key>'}, else null. */
    static String symptomKey(RuleSpec spec) {
        if (spec.trigger() == null || spec.trigger().when() == null) {
            return null;
        }
        Matcher m = SYMPTOM_KEY.matcher(spec.trigger().when());
        return m.find() ? m.group(1) : null;
    }

    /** A rule and the template keys its version in force and its draft use. */
    private record Usage(RuleRef rule, List<String> templateKeys) {
    }

    private List<Usage> usage(String tenantCode) {
        List<Usage> out = new ArrayList<>();
        for (Rule r : rules.list(tenantCode)) {
            List<RuleVersion> versions = rules.versions(r.id());
            List<String> keys = new ArrayList<>();
            for (RuleVersion v : new RuleVersion[] {current(r, versions), draft(versions)}) {
                if (v != null) {
                    RuleSpec.read(v.spec()).steps().forEach(s -> keys.add(s.template()));
                }
            }
            out.add(new Usage(new RuleRef(r.id(), r.key(), r.name(), r.state()), keys));
        }
        return out;
    }

    private static TemplateView view(ConvTemplate t, List<Usage> usage) {
        List<RuleRef> usedBy = usage.stream().filter(u -> u.templateKeys().contains(t.key())).map(Usage::rule)
                .toList();
        return new TemplateView(t.id(), t.key(), t.name(), t.baseText(), t.whatsapp(), t.email(), t.updatedAt(),
                t.updatedBy(), usedBy);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
