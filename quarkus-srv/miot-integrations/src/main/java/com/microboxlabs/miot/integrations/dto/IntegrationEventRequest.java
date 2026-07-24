package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

/**
 * Something happened that bindings may want to dispatch.
 *
 * <p>Generic on purpose: a review verdict is {@code eventType = "review.verdict"} with
 * {@code scopeKind = "activiti_task"} and the task's form key as {@code scopeKey} (e.g.
 * {@code wfship2:presentDriverTask} — the stable Activiti identity, unlike a board's display
 * title, which is a many-to-one projection that renaming would silently break).
 *
 * <p>{@code context} is the whole {@code {task, content, review, session}} snapshot the
 * templates render against. The producer supplies it in full — including {@code session},
 * which is the <b>reviewer</b>. The modulith cannot fill that in: dispatch happens later on a
 * worker thread with no user, so an identity not captured here is gone.
 */
public record IntegrationEventRequest(
        String eventType,
        String scopeKind,
        String scopeKey,
        Map<String, Object> context,
        /**
         * Optional idempotency key from the producer. Two deliveries of the same verdict
         * share one, so the ledger's unique index collapses them instead of calling the
         * partner twice.
         */
        String eventKey) {
}
