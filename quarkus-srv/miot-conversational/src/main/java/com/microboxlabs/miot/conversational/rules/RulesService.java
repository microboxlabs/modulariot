package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.rules.RuleSpecValidator.Finding;
import com.microboxlabs.miot.conversational.rules.store.RuleStore;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import com.microboxlabs.miot.core.event.EventTypeCatalog;
import com.microboxlabs.miot.core.event.ParticipantResolver;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The organization's conversation rules: list, create, drafts with their findings, publish and state, and the
 * event catalog the rules start on. Unknown ids are {@link NoSuchElementException}, bad
 * input {@link IllegalArgumentException}, a conflict {@link IllegalStateException}.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class RulesService {

    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9_-]{0,127}");
    private static final Pattern SYMPTOM_KEY = Pattern.compile("event\\.data\\.symptomKey\\s*==\\s*['\"]([^'\"]+)['\"]");
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
    private final Supplier<List<EventTypeCatalog>> catalogs;
    private final Supplier<List<ParticipantResolver>> resolvers;
    private final Clock clock;

    @Inject
    RulesService(RuleStore rules, TemplateStore templates, Instance<EventTypeCatalog> catalogs,
            Instance<ParticipantResolver> resolvers) {
        this(rules, templates, () -> catalogs.stream().toList(), () -> resolvers.stream().toList(),
                Clock.systemUTC());
    }

    public RulesService(RuleStore rules, TemplateStore templates, Supplier<List<EventTypeCatalog>> catalogs,
            Supplier<List<ParticipantResolver>> resolvers, Clock clock) {
        this.rules = rules;
        this.templates = templates;
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
        requireKey(key);
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

    /** The draft, else the version in force; null for neither. */
    public RuleVersion editing(String tenantCode, String id) {
        Rule rule = rule(tenantCode, id);
        List<RuleVersion> versions = rules.versions(rule.id());
        return draft(versions) != null ? draft(versions) : current(rule, versions);
    }

    public List<EventCatalog.EventTypeView> events() {
        return catalog().types();
    }

    private EventCatalog catalog() {
        return new EventCatalog(catalogs.get());
    }

    static void requireKey(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("key: letras minúsculas, números, - y _ (hasta 128)");
        }
    }

    private Rule rule(String tenantCode, String id) {
        return rules.find(tenantCode, id).orElseThrow(() -> new NoSuchElementException(RULE_NOT_FOUND));
    }

    static RuleVersion draft(List<RuleVersion> versions) {
        return versions.stream().filter(v -> v.status() == RuleVersion.Status.DRAFT).findFirst().orElse(null);
    }

    static RuleVersion current(Rule rule, List<RuleVersion> versions) {
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

}
