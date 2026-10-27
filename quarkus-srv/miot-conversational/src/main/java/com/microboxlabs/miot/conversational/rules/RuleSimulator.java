package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.RuleSpec.Step;
import com.microboxlabs.miot.conversational.rules.RuleSpecValidator.Finding;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import com.microboxlabs.miot.core.event.ContactDirectory;
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
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Runs a rule's draft (else its version in force) on a sample event without storing or sending anything: whether
 * it matches, who would get messages, and each message at its time when nobody replies.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class RuleSimulator {

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

    private final RulesService rules;
    private final TemplateStore templates;
    private final Supplier<List<ParticipantResolver>> resolvers;
    private final Supplier<List<ContactDirectory>> directories;
    private final Clock clock;

    @Inject
    RuleSimulator(RulesService rules, TemplateStore templates, Instance<ParticipantResolver> resolvers,
            Instance<ContactDirectory> directories) {
        this(rules, templates, () -> resolvers.stream().toList(), () -> directories.stream().toList(),
                Clock.systemUTC());
    }

    public RuleSimulator(RulesService rules, TemplateStore templates, Supplier<List<ParticipantResolver>> resolvers,
            Clock clock) {
        this(rules, templates, resolvers, List::of, clock);
    }

    public RuleSimulator(RulesService rules, TemplateStore templates, Supplier<List<ParticipantResolver>> resolvers,
            Supplier<List<ContactDirectory>> directories, Clock clock) {
        this.directories = directories;
        this.rules = rules;
        this.templates = templates;
        this.resolvers = resolvers;
        this.clock = clock;
    }

    public Simulation simulate(String tenantCode, String id, SampleEvent sample) {
        if (sample == null || sample.type() == null) {
            throw new IllegalArgumentException("event.type is required");
        }
        RuleVersion version = rules.editing(tenantCode, id);
        RuleSpec spec = RuleSpec.read(version == null ? null : version.spec());
        StoredEvent event = sampleEvent(tenantCode, sample);
        List<Finding> findings = rules.validate(tenantCode, spec);
        if (!RulesEngine.matches(spec, event)) {
            return new Simulation(false, List.of(), List.of(), findings);
        }
        Audiences audiences = new Audiences(resolvers.get(), directories.get());
        Map<String, Recipient> recipients = new LinkedHashMap<>();
        List<SimulatedMessage> messages = new ArrayList<>();
        List<Step> steps = spec.steps();
        Instant t = steps.isEmpty() ? event.at() : event.at().plus(Duration.ofMinutes(steps.get(0).afterMinutes()));
        for (int i = 0; i < steps.size(); i++) {
            Step step = steps.get(i);
            StepMessages.Plan plan = StepMessages.plan(step, spec, event, template(step), audiences);
            plan.recipients().forEach(p -> recipients.putIfAbsent(p.channel() + ":" + p.address(),
                    new Recipient(p.address(), p.channel(), p.name(), p.role())));
            int index = i;
            Instant stepAt = t;
            plan.messages().forEach(m -> messages.add(new SimulatedMessage(index, stepAt, m.channel(),
                    new To(m.to().address(), m.to().channel(), m.to().name()), m.text())));
            int after = i + 1 < steps.size() ? steps.get(i + 1).afterMinutes() : 0;
            t = t.plus(Duration.ofMinutes((long) step.waitMinutes() + after));
        }
        return new Simulation(true, List.copyOf(recipients.values()), messages, findings);
    }

    private StoredEvent sampleEvent(String tenantCode, SampleEvent sample) {
        Instant at = sample.at() != null ? sample.at() : clock.instant();
        SampleContext context = sample.context() == null ? new SampleContext(null, null) : sample.context();
        return new StoredEvent("simulation", tenantCode, sample.type(), "simulation", context.kind(), context.key(),
                sample.data(), sample.test(), at, at);
    }

    /** Templates are the platform's, whichever organization the rule is from. */
    private Optional<ConvTemplate> template(Step step) {
        return step.template() == null ? Optional.empty()
                : templates.find(ConvTemplate.PLATFORM_TENANT, step.template());
    }
}
