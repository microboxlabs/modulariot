package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleContext;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleEvent;
import com.microboxlabs.miot.conversational.rules.RuleSpecValidator.Finding;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Starts a rule on request, without its trigger: its steps at their times, with its templates and channels, to its
 * groups or to the people the request names for them, stopping on a reply as the rule says.
 *
 * <ul>
 *   <li>The version in force: refused when the rule is OFF or was never published. A TEST rule's messages are
 *       SIMULATED.</li>
 *   <li>The draft: refused when it has errors. Its messages are sent; its connection steps call nothing.</li>
 * </ul>
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class RuleInvocations {

    private final RulesService rules;
    private final RulesEngine engine;
    private final Clock clock;

    @Inject
    RuleInvocations(RulesService rules, RulesEngine engine) {
        this(rules, engine, Clock.systemUTC());
    }

    public RuleInvocations(RulesService rules, RulesEngine engine, Clock clock) {
        this.rules = rules;
        this.engine = engine;
        this.clock = clock;
    }

    public Run start(String tenantCode, String id, Invocation invocation) {
        if (invocation.key() != null && invocation.key().length() > Invocation.MAX_KEY) {
            throw new IllegalArgumentException("key: hasta " + Invocation.MAX_KEY + " caracteres");
        }
        RulesService.RuleDetail detail = rules.detail(tenantCode, id);
        Rule rule = detail.rule();
        Selection selection = selectVersion(tenantCode, detail, invocation);
        RuleVersion version = selection.version();
        boolean test = selection.test();
        RuleSpec spec = RuleSpec.read(version.spec());
        Map<String, List<Invocation.Person>> to = Invocation.recipients(spec, invocation.to());
        Run run = new Run(null, tenantCode, rule.id(), invocation.isDraft() ? Invocation.DRAFT : version.version(), null,
                null, null, test, Run.Status.WAITING, 0, null, null, null, null, to.isEmpty() ? null : to,
                invocation.key());
        return engine.invoke(event(tenantCode, spec, invocation), run, spec.steps());
    }

    private record Selection(RuleVersion version, boolean test) {
    }

    private Selection selectVersion(String tenantCode, RulesService.RuleDetail detail, Invocation invocation) {
        if (invocation.isDraft()) {
            RuleVersion version = detail.draft() != null ? detail.draft() : detail.current();
            if (version == null) {
                throw new IllegalArgumentException("the rule has no draft");
            }
            List<Finding> findings = rules.validate(tenantCode, RuleSpec.read(version.spec()));
            if (!RuleSpecValidator.publishable(findings)) {
                throw new RulesService.NotPublishable(findings);
            }
            return new Selection(version, false);
        }
        if (Invocation.CURRENT.equals(invocation.version())) {
            Rule rule = detail.rule();
            if (rule.state() == Rule.State.OFF) {
                throw new IllegalStateException("La regla está apagada");
            }
            RuleVersion version = detail.current();
            if (version == null) {
                throw new IllegalStateException("La regla no tiene una versión publicada");
            }
            return new Selection(version, rule.state() == Rule.State.TEST);
        }
        throw new IllegalArgumentException("version: current o draft");
    }

    private StoredEvent event(String tenantCode, RuleSpec spec, Invocation invocation) {
        SampleEvent sample = invocation.event();
        String defaultType = spec.trigger() == null ? null : spec.trigger().event();
        String type = sample != null && sample.type() != null ? sample.type() : defaultType;
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("event.type is required");
        }
        Instant at = sample != null && sample.at() != null ? sample.at() : clock.instant();
        SampleContext context = sample == null || sample.context() == null ? new SampleContext(null, null)
                : sample.context();
        return new StoredEvent(null, tenantCode, type, Invocation.SOURCE, context.kind(), context.key(),
                sample == null ? null : sample.data(), invocation.isDraft(), at, at);
    }
}
