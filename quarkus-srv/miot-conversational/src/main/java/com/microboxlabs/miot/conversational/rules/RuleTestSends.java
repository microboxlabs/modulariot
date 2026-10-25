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

/**
 * Sends a rule's draft for real to one chosen person, on a sample event: its steps at their times, with its
 * templates and channels, stopping on a reply as the rule says. A draft with errors is refused.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class RuleTestSends {

    private final RulesService rules;
    private final RulesEngine engine;
    private final Clock clock;

    @Inject
    RuleTestSends(RulesService rules, RulesEngine engine) {
        this(rules, engine, Clock.systemUTC());
    }

    public RuleTestSends(RulesService rules, RulesEngine engine, Clock clock) {
        this.rules = rules;
        this.engine = engine;
        this.clock = clock;
    }

    public Run start(String tenantCode, String id, SampleEvent sample, TestSend.To to) {
        if (to == null || to.isEmpty()) {
            throw new IllegalArgumentException("to.email or to.phone is required");
        }
        RuleVersion version = rules.editing(tenantCode, id);
        if (version == null) {
            throw new IllegalArgumentException("the rule has no draft");
        }
        List<Finding> findings = rules.validate(tenantCode, RuleSpec.read(version.spec()));
        if (!RuleSpecValidator.publishable(findings)) {
            throw new RulesService.NotPublishable(findings);
        }
        RuleSpec spec = RuleSpec.read(version.spec());
        String type = sample != null && sample.type() != null ? sample.type()
                : spec.trigger() == null ? null : spec.trigger().event();
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("event.type is required");
        }
        Instant at = sample != null && sample.at() != null ? sample.at() : clock.instant();
        SampleContext context = sample == null || sample.context() == null ? new SampleContext(null, null)
                : sample.context();
        StoredEvent event = new StoredEvent(null, tenantCode, type, TestSend.VERSION, context.kind(), context.key(),
                sample == null ? null : sample.data(), true, at, at);
        return engine.startTestSend(version.ruleId(), version.spec(), event, to);
    }
}
