package com.microboxlabs.miot.conversational.rules;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * One rule version started by one event. {@code step} is the index of the next step to send and
 * {@code nextAt} when; after the last step the run waits for its last reply until {@code nextAt}, then is DONE.
 * A test run records its messages as SIMULATED and sends nothing.
 *
 * <p>A run started by an {@link Invocation} may name {@code recipients} for some groups, and keeps the caller's
 * {@code invocationKey}. Its {@code ruleVersion} is {@value Invocation#DRAFT} when it sends the draft.
 */
public record Run(String id, String tenantCode, String ruleId, String ruleVersion, String eventId, String contextKind,
        String contextKey, boolean test, Status status, int step, Instant nextAt, String lastError,
        Instant createdAt, Instant updatedAt, Map<String, List<Invocation.Person>> recipients,
        String invocationKey) {

    public enum Status {
        WAITING,
        REPLIED,
        DONE,
        FAILED,
        CANCELLED
    }

    public Run(String id, String tenantCode, String ruleId, String ruleVersion, String eventId, String contextKind,
            String contextKey, boolean test, Status status, int step, Instant nextAt, String lastError,
            Instant createdAt, Instant updatedAt) {
        this(id, tenantCode, ruleId, ruleVersion, eventId, contextKind, contextKey, test, status, step, nextAt,
                lastError, createdAt, updatedAt, null, null);
    }

    public Run advanced(Status newStatus, int newStep, Instant newNextAt, String error, Instant at) {
        return new Run(id, tenantCode, ruleId, ruleVersion, eventId, contextKind, contextKey, test, newStatus,
                newStep, newNextAt, error, createdAt, at, recipients, invocationKey);
    }
}
