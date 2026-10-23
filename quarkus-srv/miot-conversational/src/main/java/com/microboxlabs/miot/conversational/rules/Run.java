package com.microboxlabs.miot.conversational.rules;

import java.time.Instant;

/**
 * One rule version started by one event. {@code step} is the index of the next step to send and
 * {@code nextAt} when; after the last step the run waits for its last reply until {@code nextAt}, then is DONE.
 * A test run records its messages as SIMULATED and sends nothing.
 */
public record Run(String id, String tenantCode, String ruleId, int ruleVersion, String eventId, String contextKind,
        String contextKey, boolean test, Status status, int step, Instant nextAt, String lastError,
        Instant createdAt, Instant updatedAt) {

    public enum Status {
        WAITING,
        REPLIED,
        DONE,
        FAILED,
        CANCELLED
    }

    public Run advanced(Status newStatus, int newStep, Instant newNextAt, String error, Instant at) {
        return new Run(id, tenantCode, ruleId, ruleVersion, eventId, contextKind, contextKey, test, newStatus,
                newStep, newNextAt, error, createdAt, at);
    }
}
