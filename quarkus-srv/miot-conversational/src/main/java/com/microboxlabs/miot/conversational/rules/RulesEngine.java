package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Step;
import com.microboxlabs.miot.conversational.rules.store.RuleStore;
import com.microboxlabs.miot.conversational.rules.store.RunStore;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import com.microboxlabs.miot.conversational.service.ConnectionMessagingService;
import com.microboxlabs.miot.conversational.service.ContextMessage;
import com.microboxlabs.miot.conversational.service.EmailMessagingService;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.core.event.ContactDirectory;
import com.microboxlabs.miot.core.event.ParticipantResolver;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.ObservesAsync;
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
import java.util.UUID;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Runs the conversation rules.
 *
 * <ul>
 *   <li>Each {@link OperationalEvent} is stored, then starts a run for every TEST or ACTIVE rule whose published
 *       version in force matches it (event type, then {@code when}). A test event starts only TEST rules. A run
 *       of a TEST rule, or started by a test event, is a test run: its messages are SIMULATED.</li>
 *   <li>Every 15 s the due WAITING runs are claimed and their next step sent. A step that waits for a reply
 *       moves {@code next_at} by its wait plus the next step's {@code after}; otherwise the next step goes out
 *       right away. After the last step, and its wait, the run is DONE.</li>
 *   <li>A reply on a run's conversation makes it REPLIED when the step it answers says {@code onReply: stop}.</li>
 *   <li>{@code symptom.case.closed} cancels the WAITING runs about the same case.</li>
 * </ul>
 *
 * Delivery errors and audience warnings are stored on the run as {@code last_error}; the run goes on. Observers
 * are asynchronous, so the producer is never held. Off with {@code miot.conversational.rules.enabled=false}.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class RulesEngine {

    public static final String CASE_CLOSED = "symptom.case.closed";
    static final Duration LEASE = Duration.ofMinutes(2);
    static final int BATCH = 50;
    private static final Logger LOG = Logger.getLogger(RulesEngine.class);
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    private final boolean enabled;
    private final RuleStore rules;
    private final TemplateStore templates;
    private final RunStore runs;
    private final Supplier<List<ParticipantResolver>> resolvers;
    private final Supplier<List<ContactDirectory>> directories;
    private final WhatsAppMessagingService whatsapp;
    private final EmailMessagingService email;
    private final ConnectionChannels channels;
    private final ConnectionMessagingService connectionMessages;
    private final ObjectMapper json;
    private final Clock clock;

    @Inject
    RulesEngine(@ConfigProperty(name = "miot.conversational.rules.enabled", defaultValue = "true") boolean enabled,
            RuleStore rules, TemplateStore templates, RunStore runs, Instance<ParticipantResolver> resolvers,
            Instance<ContactDirectory> directories, WhatsAppMessagingService whatsapp, EmailMessagingService email,
            ConnectionChannels channels, ConnectionMessagingService connectionMessages, ObjectMapper json) {
        this(enabled, new Stores(rules, templates, runs), () -> resolvers.stream().toList(),
                () -> directories.stream().toList(), new Senders(whatsapp, email, channels, connectionMessages), json,
                Clock.systemUTC());
    }

    /** Where rules, templates and runs are kept. */
    public record Stores(RuleStore rules, TemplateStore templates, RunStore runs) {
    }

    /** The channels a step sends on; {@code connectionMessages} stores what a connection step sends. */
    public record Senders(WhatsAppMessagingService whatsapp, EmailMessagingService email,
            ConnectionChannels channels, ConnectionMessagingService connectionMessages) {
    }

    public RulesEngine(boolean enabled, Stores stores, Supplier<List<ParticipantResolver>> resolvers,
            Senders senders, ObjectMapper json, Clock clock) {
        this(enabled, stores, resolvers, List::of, senders, json, clock);
    }

    public RulesEngine(boolean enabled, Stores stores, Supplier<List<ParticipantResolver>> resolvers,
            Supplier<List<ContactDirectory>> directories, Senders senders, ObjectMapper json, Clock clock) {
        this.enabled = enabled;
        this.directories = directories;
        this.rules = stores.rules();
        this.templates = stores.templates();
        this.runs = stores.runs();
        this.resolvers = resolvers;
        this.whatsapp = senders.whatsapp();
        this.email = senders.email();
        this.channels = senders.channels();
        this.connectionMessages = senders.connectionMessages();
        this.json = json;
        this.clock = clock;
    }

    void onEvent(@ObservesAsync OperationalEvent event) {
        if (!enabled) {
            return;
        }
        try {
            accept(event);
        } catch (RuntimeException e) {
            LOG.warnf(e, "Conversation rules: event %s for %s not handled", event.type(), event.tenantCode());
        }
    }

    /** A reply stored by an inbound message job: a failure propagates, so the job retries. */
    void onReplyInJob(@Observes ConversationReplyReceived reply) {
        if (enabled) {
            replied(reply);
        }
    }

    void onReply(@ObservesAsync ConversationReplyReceived reply) {
        if (!enabled) {
            return;
        }
        try {
            replied(reply);
        } catch (RuntimeException e) {
            LOG.warnf(e, "Conversation rules: reply %s not handled", reply.messageId());
        }
    }

    @Scheduled(every = "${miot.conversational.rules.every:15s}", delayed = "20s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void tick() {
        if (!enabled) {
            return;
        }
        try {
            runDue();
        } catch (RuntimeException e) {
            // The runs stay WAITING; the next scan claims them again once their lease ends.
            LOG.warnf("Conversation rules: scan failed (%s)", e.getClass().getSimpleName());
        }
    }

    /** Stores the event, cancels what it closes, and returns the runs it started. */
    public List<Run> accept(OperationalEvent event) {
        Instant now = clock.instant();
        StoredEvent stored = runs.saveEvent(new StoredEvent(UUID.randomUUID().toString(), event.tenantCode(),
                event.type(), event.source(), event.context().kind(), event.context().key(), data(event.data()),
                event.test(), event.at(), now));
        if (CASE_CLOSED.equals(stored.type())) {
            cancelWaiting(stored, now);
        }
        return start(stored, now);
    }

    private List<Run> start(StoredEvent event, Instant now) {
        List<Run> started = new ArrayList<>();
        for (RuleStore.InForce f : rules.inForce(event.tenantCode())) {
            Rule rule = f.rule();
            RuleSpec spec = RuleSpec.read(f.version().spec());
            if ((event.test() && rule.state() != Rule.State.TEST) || !matches(spec, event)) {
                continue;
            }
            boolean empty = spec.steps().isEmpty();
            Instant nextAt = empty ? null : event.at().plus(Duration.ofMinutes(spec.steps().get(0).afterMinutes()));
            started.add(runs.createRun(new Run(UUID.randomUUID().toString(), event.tenantCode(), rule.id(),
                    f.version().version(), event.id(), event.contextKind(), event.contextKey(),
                    event.test() || rule.state() == Rule.State.TEST, empty ? Run.Status.DONE : Run.Status.WAITING,
                    0, nextAt, null, now, now)));
        }
        return started;
    }

    /** The trigger's event type, then its {@code when}. */
    public static boolean matches(RuleSpec spec, StoredEvent event) {
        return spec.trigger() != null && event.type().equals(spec.trigger().event())
                && EventCondition.matches(spec.trigger().when(), event.asCelEvent());
    }

    private void cancelWaiting(StoredEvent event, Instant now) {
        if (event.contextKind() == null || event.contextKey() == null) {
            return;
        }
        for (Run run : runs.waiting(event.tenantCode(), event.contextKind(), event.contextKey())) {
            runs.updateIfWaiting(run.advanced(Run.Status.CANCELLED, run.step(), null, run.lastError(), now));
        }
    }

    /** Claims the due runs and sends their steps; returns how many runs it claimed. */
    public int runDue() {
        Instant now = clock.instant();
        List<Run> due = runs.claimDue(now, LEASE, BATCH);
        for (Run run : due) {
            try {
                advance(run, now);
            } catch (RuntimeException e) {
                LOG.warnf(e, "Conversation run %s: step %d failed", run.id(), run.step());
            }
        }
        return due.size();
    }

    /**
     * Starts a run of an {@link Invocation}: its event stored, and the run due at its first step's time. With a
     * key the rule already ran, the run that key started.
     */
    public Run invoke(StoredEvent sample, Run run, List<Step> steps) {
        Optional<Run> first = runs.invoked(run.ruleId(), run.invocationKey());
        if (first.isPresent()) {
            return first.get();
        }
        Instant now = clock.instant();
        StoredEvent event = runs.saveEvent(new StoredEvent(UUID.randomUUID().toString(), sample.tenantCode(),
                sample.type(), Invocation.SOURCE, sample.contextKind(), sample.contextKey(), sample.data(),
                sample.test(), sample.at() != null ? sample.at() : now, now));
        boolean empty = steps.isEmpty();
        return runs.createRun(new Run(UUID.randomUUID().toString(), event.tenantCode(), run.ruleId(),
                run.ruleVersion(), event.id(), event.contextKind(), event.contextKey(), run.test(),
                empty ? Run.Status.DONE : Run.Status.WAITING, 0,
                empty ? null : now.plus(Duration.ofMinutes(steps.get(0).afterMinutes())), null, now, now,
                run.recipients(), run.invocationKey()));
    }

    /** The spec a run sends: its version's, or the draft as it is now for a run of the draft. */
    private Optional<RuleSpec> spec(Run run) {
        Optional<RuleVersion> version = Invocation.DRAFT.equals(run.ruleVersion()) ? draftOrCurrent(run)
                : rules.version(run.ruleId(), run.ruleVersion());
        return version.map(v -> RuleSpec.read(v.spec()));
    }

    /** The draft; once it is published, the version in force. */
    private Optional<RuleVersion> draftOrCurrent(Run run) {
        List<RuleVersion> versions = rules.versions(run.ruleId());
        RuleVersion draft = RulesService.draft(versions);
        if (draft != null) {
            return Optional.of(draft);
        }
        return rules.find(run.tenantCode(), run.ruleId()).map(r -> RulesService.current(r, versions));
    }

    private void advance(Run run, Instant now) {
        Optional<RuleSpec> found = spec(run);
        Optional<StoredEvent> event = runs.event(run.eventId());
        if (found.isEmpty() || event.isEmpty()) {
            runs.updateIfWaiting(run.advanced(Run.Status.FAILED, run.step(), null,
                    "La versión de la regla o el evento ya no existe", now));
            return;
        }
        RuleSpec spec = found.get();
        List<Step> steps = spec.steps();
        Run current = run;
        while (true) {
            if (current.step() >= steps.size()) {
                runs.updateIfWaiting(current.advanced(Run.Status.DONE, current.step(), null, current.lastError(), now));
                return;
            }
            Step step = steps.get(current.step());
            String problems = send(current, step, spec, event.get());
            String lastError = problems != null ? problems : current.lastError();
            int next = current.step() + 1;
            int wait = step.waitMinutes();
            if (next >= steps.size() && wait == 0) {
                runs.updateIfWaiting(current.advanced(Run.Status.DONE, next, null, lastError, now));
                return;
            }
            int after = next < steps.size() ? steps.get(next).afterMinutes() : 0;
            Instant nextAt = now.plus(Duration.ofMinutes((long) wait + after));
            current = current.advanced(Run.Status.WAITING, next, nextAt, lastError, now);
            // A run replied or cancelled meanwhile is no longer WAITING: it stops here.
            if (!runs.updateIfWaiting(current) || nextAt.isAfter(now)) {
                return;
            }
        }
    }

    /** Sends one step to its recipients; returns the warnings and delivery errors, or null when there are none. */
    private String send(Run run, Step step, RuleSpec spec, StoredEvent event) {
        Optional<ConvTemplate> template = step.template() == null ? Optional.empty()
                : templates.find(ConvTemplate.PLATFORM_TENANT, step.template());
        StepMessages.Plan plan = StepMessages.plan(step, Invocation.forStep(spec, step, run.recipients()), event,
                template, new Audiences(resolvers.get(), directories.get()));
        List<String> problems = new ArrayList<>(plan.warnings());
        ContextKind kind = contextKind(run.contextKind());
        for (StepMessages.Planned m : plan.messages()) {
            Optional<ConnectionChannel> viaConnection = ConnectionChannel.of(m.channel());
            if (viaConnection.isPresent()) {
                // A run of the draft is a test: it writes to people only, the connection is not called.
                boolean simulate = run.test() || Invocation.DRAFT.equals(run.ruleVersion());
                deliver(viaConnection.get(), run, event, kind, m, simulate).ifPresent(problems::add);
                continue;
            }
            boolean isWhatsApp = RuleSpec.WHATSAPP.equals(m.channel());
            ContextMessage message = new ContextMessage(kind, run.contextKey(), m.to().address(), m.to().name(),
                    m.to().role(), m.to().contactId(),
                    isWhatsApp ? m.template().whatsapp().metaName() : m.template().key(),
                    isWhatsApp ? m.template().whatsapp().language() : null, m.params(), m.subject(), m.text(),
                    run.id(), run.step());
            Message stored = isWhatsApp ? whatsapp.sendInContext(run.tenantCode(), message, run.test())
                    : email.sendInContext(run.tenantCode(), message, run.test());
            if (stored.status() == MessageStatus.FAILED) {
                problems.add(m.to().address() + ": " + stored.errorMessage());
            }
        }
        return problems.isEmpty() ? null : String.join("; ", problems);
    }

    /**
     * Calls the connection step's connection once and stores the call as a message to the connection; with
     * {@code simulate} it calls nothing and stores it SIMULATED. Returns the problem when the call failed or was
     * refused.
     */
    private Optional<String> deliver(ConnectionChannel channel, Run run, StoredEvent event, ContextKind kind,
            StepMessages.Planned m, boolean simulate) {
        String connection = m.to().address();
        Rule rule = rules.find(run.tenantCode(), run.ruleId()).orElse(null);
        String name = channels.name(run.tenantCode(), connection).orElse(null);
        ConnectionChannel.Delivery delivery = new ConnectionChannel.Delivery(event, run, rule, m.subject(), m.text());
        ContextMessage message = new ContextMessage(kind, run.contextKey(), connection, name, null, null,
                m.template() == null ? null : m.template().key(), null, Map.of(), m.subject(),
                delivery.textOrSummary(), run.id(), run.step());
        Message stored = connectionMessages.sendInContext(run.tenantCode(), Channel.fromDb(channel.key()), message,
                simulate, () -> channels.deliver(channel, run.tenantCode(), connection, channel.body(delivery)));
        return stored.status() == MessageStatus.FAILED
                ? Optional.of(channel.key() + " " + connection + ": " + stored.errorMessage())
                : Optional.empty();
    }

    /**
     * The reply stops its run when the step it answers says so. A reply that names a run (it answers one of the
     * run's messages) affects only that run, and nothing once that run stopped waiting. The step answered is the
     * one of the named message, else the run's latest step sent.
     */
    public Optional<Run> replied(ConversationReplyReceived reply) {
        Optional<Run> run = reply.runId() != null
                ? runs.find(reply.runId()).filter(r -> r.status() == Run.Status.WAITING)
                : runs.waitingOnConversation(reply.tenantCode(), reply.conversationId());
        if (run.isEmpty() || !run.get().tenantCode().equals(reply.tenantCode()) || run.get().step() == 0) {
            return Optional.empty();
        }
        Run r = run.get();
        Optional<RuleSpec> spec = spec(r);
        if (spec.isEmpty()) {
            return Optional.empty();
        }
        List<Step> steps = spec.get().steps();
        int answered = reply.answeredStep() != null ? reply.answeredStep() : r.step() - 1;
        if (answered < 0 || answered >= r.step() || answered >= steps.size() || !steps.get(answered).stopsOnReply()) {
            return Optional.empty();
        }
        Run done = r.advanced(Run.Status.REPLIED, r.step(), null, r.lastError(), clock.instant());
        return runs.updateIfWaiting(done) ? Optional.of(done) : Optional.empty();
    }

    private Map<String, Object> data(Object data) {
        if (data == null) {
            return Map.of();
        }
        try {
            return new LinkedHashMap<>(json.convertValue(data, MAP));
        } catch (IllegalArgumentException e) {
            LOG.warnf("Conversation rules: event data of %s is not an object", data.getClass().getSimpleName());
            return Map.of();
        }
    }

    static ContextKind contextKind(String kind) {
        try {
            return ContextKind.fromDb(kind);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
