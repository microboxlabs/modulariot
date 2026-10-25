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

    public record RuleSummary(String id, String key, String name, Rule.State state, String currentVersion,
            boolean hasDraft, TriggerView trigger, int stepsCount, List<String> channels, String symptomKey,
            Instant updatedAt) {
    }

    /**
     * What publishing the draft would do: the bump its changes call for and the version it gets. Both are null
     * when the draft does the same as the version in force.
     */
    public record PublishPlan(RuleBump bump, String nextVersion) {
    }

    /** {@code plan} and {@code findings} are null without a draft. */
    public record RuleDetail(Rule rule, RuleVersion current, RuleVersion draft, List<RuleVersion> versions,
            PublishPlan plan, List<Finding> findings) {
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
    private final ConnectionCheck connectionCheck;

    /** Whether a connection id is one of the organization's connections of a channel. */
    @FunctionalInterface
    public interface ConnectionCheck {
        boolean known(String tenantCode, String channel, String connectionId);
    }

    @Inject
    RulesService(RuleStore rules, TemplateStore templates, Instance<EventTypeCatalog> catalogs,
            Instance<ParticipantResolver> resolvers, ConnectionChannels channels) {
        this(rules, templates, () -> catalogs.stream().toList(), () -> resolvers.stream().toList(),
                Clock.systemUTC(), (tenant, channel, id) -> known(channels, tenant, channel, id));
    }

    public RulesService(RuleStore rules, TemplateStore templates, Supplier<List<EventTypeCatalog>> catalogs,
            Supplier<List<ParticipantResolver>> resolvers, Clock clock) {
        this(rules, templates, catalogs, resolvers, clock, (tenant, channel, id) -> true);
    }

    public RulesService(RuleStore rules, TemplateStore templates, Supplier<List<EventTypeCatalog>> catalogs,
            Supplier<List<ParticipantResolver>> resolvers, Clock clock, ConnectionCheck connectionCheck) {
        this.rules = rules;
        this.templates = templates;
        this.catalogs = catalogs;
        this.resolvers = resolvers;
        this.clock = clock;
        this.connectionCheck = connectionCheck;
    }

    private static boolean known(ConnectionChannels channels, String tenant, String channel, String id) {
        try {
            return ConnectionChannel.of(channel).flatMap(c -> channels.connection(c, tenant, id)).isPresent();
        } catch (RuntimeException e) {
            return false;
        }
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
                    spec.steps().size(), spec.channels(), symptomKey(spec), r.updatedAt()));
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
        RuleVersion current = current(rule, versions);
        RuleVersion draft = draft(versions);
        return new RuleDetail(rule, current, draft,
                versions.stream().filter(v -> v.status() == RuleVersion.Status.PUBLISHED).toList(),
                draft == null ? null : plan(rule, current, draft),
                draft == null ? null : validate(tenantCode, RuleSpec.read(draft.spec())));
    }

    /** The first publish is MINOR, to {@link RuleBump#FIRST}; later ones bump by what changed. */
    static PublishPlan plan(Rule rule, RuleVersion current, RuleVersion draft) {
        if (current == null) {
            return new PublishPlan(RuleBump.MINOR, RuleBump.FIRST);
        }
        RuleBump bump = RuleBump.between(RuleSpec.read(current.spec()), RuleSpec.read(draft.spec()));
        return bump == null ? new PublishPlan(null, null)
                : new PublishPlan(bump, bump.next(rule.currentVersion()));
    }

    public DraftResult saveDraft(String tenantCode, String id, JsonNode spec, String actor) {
        if (spec == null || !spec.isObject()) {
            throw new IllegalArgumentException("spec must be an object");
        }
        Rule rule = rule(tenantCode, id);
        RuleVersion draft = rules.saveDraft(rule.id(), spec, actor, clock.instant());
        return new DraftResult(draft, validate(tenantCode, RuleSpec.read(spec)));
    }

    /**
     * Drops the draft so the rule shows its version in force again. A rule never published has nothing to go back
     * to, so its draft stays.
     */
    public void discardDraft(String tenantCode, String id) {
        Rule rule = rule(tenantCode, id);
        if (rule.currentVersion() == null) {
            throw new IllegalArgumentException("the rule has no published version to go back to");
        }
        rules.discardDraft(rule.id());
    }

    /**
     * Publishes the draft as the version its changes call for. {@code requested} may raise the bump, never lower
     * it; it does not apply to the first publish, which is always {@link RuleBump#FIRST}.
     */
    public RuleVersion publish(String tenantCode, String id, String reason, RuleBump requested, String actor) {
        Rule rule = rule(tenantCode, id);
        List<RuleVersion> versions = rules.versions(rule.id());
        RuleVersion draft = draft(versions);
        if (draft == null) {
            throw new IllegalStateException("La regla no tiene borrador");
        }
        List<Finding> findings = validate(tenantCode, RuleSpec.read(draft.spec()));
        if (!RuleSpecValidator.publishable(findings)) {
            throw new NotPublishable(findings);
        }
        PublishPlan plan = plan(rule, current(rule, versions), draft);
        if (plan.bump() == null) {
            throw new IllegalStateException("El borrador es igual a la versión publicada");
        }
        RuleBump bump = rule.currentVersion() == null ? plan.bump() : plan.bump().atLeast(requested);
        String version = rule.currentVersion() == null ? RuleBump.FIRST : bump.next(rule.currentVersion());
        return rules.publish(rule.id(), draft.spec(),
                new RuleStore.Publication(rule.currentVersion(), version, bump, reason, actor, clock.instant()))
                .orElseThrow(() -> new IllegalStateException(
                        "El borrador cambió mientras se publicaba; vuelve a publicarlo"));
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
        templates.list(ConvTemplate.PLATFORM_TENANT).forEach(t -> byKey.put(t.key(), t));
        Audiences audiences = new Audiences(resolvers.get());
        return RuleSpecValidator.validate(spec, new RuleSpecValidator.Context(catalog().contextKinds(), byKey,
                kind -> audiences.roles(tenantCode, kind),
                (channel, id) -> connectionCheck.known(tenantCode, channel, id)));
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
