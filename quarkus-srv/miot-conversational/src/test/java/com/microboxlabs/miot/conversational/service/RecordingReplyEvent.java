package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.NotificationOptions;
import jakarta.enterprise.util.TypeLiteral;
import java.lang.annotation.Annotation;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

/** Observes fired reply events instead of dispatching to CDI observers. */
final class RecordingReplyEvent implements Event<ConversationReplyReceived> {
    final List<ConversationReplyReceived> fired = new ArrayList<>();
    RuntimeException failWith;

    @Override
    public void fire(ConversationReplyReceived event) {
        throw new UnsupportedOperationException("replies are fired asynchronously");
    }

    @Override
    public <U extends ConversationReplyReceived> CompletionStage<U> fireAsync(U event) {
        if (failWith != null) {
            return CompletableFuture.failedFuture(failWith);
        }
        fired.add(event);
        return CompletableFuture.completedFuture(event);
    }

    @Override
    public <U extends ConversationReplyReceived> CompletionStage<U> fireAsync(
            U event, NotificationOptions options) {
        return fireAsync(event);
    }

    @Override
    public Event<ConversationReplyReceived> select(Annotation... qualifiers) {
        throw new UnsupportedOperationException();
    }

    @Override
    public <U extends ConversationReplyReceived> Event<U> select(Class<U> subtype, Annotation... qualifiers) {
        throw new UnsupportedOperationException();
    }

    @Override
    public <U extends ConversationReplyReceived> Event<U> select(
            TypeLiteral<U> subtype, Annotation... qualifiers) {
        throw new UnsupportedOperationException();
    }
}
