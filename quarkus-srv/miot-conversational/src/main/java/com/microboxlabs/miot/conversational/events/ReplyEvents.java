package com.microboxlabs.miot.conversational.events;

import com.microboxlabs.miot.conversational.rules.Run;
import com.microboxlabs.miot.conversational.rules.StoredEvent;
import com.microboxlabs.miot.conversational.rules.store.RunStore;
import com.microboxlabs.miot.core.event.EventContext;
import com.microboxlabs.miot.core.event.OperationalEvent;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.ObservesAsync;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletionStage;
import java.util.function.Function;
import org.jboss.logging.Logger;

/**
 * Publishes a reply to a message a rule sent as {@code conversation.reply_received}, in the context of the event
 * that started the rule ({@code trip}, {@code symptom_case}, …), so the module that raised that event can act on the
 * answer: a trip confirms its departure when the person taps "Confirmar". A reply outside a rule run, or to a run
 * without a context, publishes nothing.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ReplyEvents {

    private static final Logger LOG = Logger.getLogger(ReplyEvents.class);

    private final RunStore runs;
    private final Function<OperationalEvent, CompletionStage<?>> fire;

    @Inject
    ReplyEvents(RunStore runs, Event<OperationalEvent> bus) {
        this(runs, bus::fireAsync);
    }

    public ReplyEvents(RunStore runs, Function<OperationalEvent, CompletionStage<?>> fire) {
        this.runs = runs;
        this.fire = fire;
    }

    void onReply(@ObservesAsync ConversationReplyReceived reply) {
        try {
            publish(reply);
        } catch (RuntimeException e) {
            LOG.warnf("Reply %s not published as an event (%s)", reply.messageId(), e.getClass().getSimpleName());
        }
    }

    /** The inbound webhook job dispatches replies synchronously. */
    public void onReplyInJob(@Observes ConversationReplyReceived reply) {
        publish(reply);
    }

    /** The event published for {@code reply}, if its run has a context. */
    public Optional<OperationalEvent> publish(ConversationReplyReceived reply) {
        if (reply.runId() == null) {
            return Optional.empty();
        }
        Optional<Run> run = runs.find(reply.runId());
        if (run.isEmpty() || !run.get().tenantCode().equals(reply.tenantCode())
                || run.get().contextKind() == null || run.get().contextKey() == null) {
            return Optional.empty();
        }
        Run r = run.get();
        Optional<StoredEvent> started = runs.event(r.eventId());
        Instant at = reply.at() == null ? Instant.now() : reply.at().toInstant();
        ConversationReplyData data = new ConversationReplyData(r.id(), r.ruleId(),
                started.map(StoredEvent::type).orElse(null), started.map(StoredEvent::data).orElse(Map.of()),
                reply.messageId(), reply.inReplyTo(), reply.channel() == null ? null : reply.channel().dbValue(),
                reply.address(), reply.text(), reply.buttonPayload(), at);
        OperationalEvent event = new OperationalEvent(ConversationEventCatalog.REPLY_RECEIVED,
                ConversationEventCatalog.EVENT_SOURCE, r.tenantCode(), at,
                new EventContext(r.contextKind(), r.contextKey()), data, r.test());
        fire.apply(event).exceptionally(e -> {
            LOG.warnf("Reply event %s: an observer failed (%s)", reply.messageId(), e.getClass().getSimpleName());
            return null;
        });
        return Optional.of(event);
    }
}
