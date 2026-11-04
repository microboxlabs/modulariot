package com.microboxlabs.miot.conversational.calling;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * When the business may call a WhatsApp user, and when it may ask for permission to.
 *
 * <p>A business-initiated call needs the user's permission, asked with a {@code call_permission_request}
 * message. Meta allows at most {@link #REQUESTS_PER_DAY} request per user in 24 hours and
 * {@link #REQUESTS_PER_WEEK} in 7 days. A granted permission is valid until its expiration (temporary) or
 * until the user revokes it (permanent).
 */
public final class CallPermissionPolicy {

    public static final int REQUESTS_PER_DAY = 1;
    public static final int REQUESTS_PER_WEEK = 2;
    static final Duration DAY = Duration.ofHours(24);
    static final Duration WEEK = Duration.ofDays(7);

    /** The user's last answer: accepted until {@code expiresAt} (null: permanent), or rejected. */
    public record Grant(boolean accepted, Instant answeredAt, Instant expiresAt) {
    }

    /** What the operator can do now. */
    public enum Decision {
        /** Permission is valid: the call can be placed. */
        CALL,
        /** No valid permission, and a request is allowed. */
        REQUEST_PERMISSION,
        /** No valid permission, and the request limit is reached until {@code nextRequestAt}. */
        WAIT
    }

    public record Outcome(Decision decision, Instant nextRequestAt) {
    }

    private CallPermissionPolicy() {
    }

    /**
     * @param requests when permission was asked of this user, any order
     * @param grant    the user's last answer, if any
     */
    public static Outcome decide(List<Instant> requests, Optional<Grant> grant, Instant now) {
        if (grant.isPresent() && grant.get().accepted()
                && (grant.get().expiresAt() == null || now.isBefore(grant.get().expiresAt()))) {
            return new Outcome(Decision.CALL, null);
        }
        List<Instant> day = requests.stream().filter(at -> now.isBefore(at.plus(DAY))).sorted().toList();
        List<Instant> week = requests.stream().filter(at -> now.isBefore(at.plus(WEEK))).sorted().toList();
        if (day.size() >= REQUESTS_PER_DAY || week.size() >= REQUESTS_PER_WEEK) {
            Instant byDay = day.size() >= REQUESTS_PER_DAY
                    ? day.get(day.size() - REQUESTS_PER_DAY).plus(DAY) : now;
            Instant byWeek = week.size() >= REQUESTS_PER_WEEK
                    ? week.get(week.size() - REQUESTS_PER_WEEK).plus(WEEK) : now;
            return new Outcome(Decision.WAIT, byDay.isAfter(byWeek) ? byDay : byWeek);
        }
        return new Outcome(Decision.REQUEST_PERMISSION, null);
    }
}
