package com.microboxlabs.miot.conversational.calling;

import com.microboxlabs.miot.conversational.service.CallEvent;
import com.microboxlabs.miot.conversational.service.CallPermissionReply;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Meta's call permission rules, as pure functions: what a reply or a call does to a permission, whether a
 * contact can be called, and whether another request may be sent. See
 * https://developers.facebook.com/docs/whatsapp/cloud-api/calling/user-call-permissions
 */
public final class CallPermissionPolicy {

    /** Requests per business number and contact in {@link #DAY}. */
    public static final int DAILY_MAX = 1;
    /** Requests per business number and contact in {@link #WEEK}. */
    public static final int WEEKLY_MAX = 2;
    public static final Duration DAY = Duration.ofHours(24);
    public static final Duration WEEK = Duration.ofDays(7);
    /** A temporary permission lasts 7 days when the reply carries no expiry. */
    public static final Duration TEMPORARY_PERMISSION = Duration.ofDays(7);
    /** A request with no answer expires 7 days after it was sent. */
    public static final Duration REQUEST_EXPIRY = Duration.ofDays(7);
    /** Meta revokes a permission after this many unanswered business-initiated calls in a row. */
    public static final int UNANSWERED_REVOKE = 4;
    static final String UNANSWERED_CALLS = "unanswered_calls";

    /** What the app shows on the WhatsApp call button. */
    public enum State {
        CAN_CALL,
        PENDING,
        NO_PERMISSION
    }

    /** Why a permission request was not sent. */
    public enum Refusal {
        CALLING_DISABLED,
        INVALID_PHONE,
        NO_CONNECTION,
        NO_TEMPLATE,
        ALREADY_GRANTED,
        DAILY_LIMIT,
        WEEKLY_LIMIT,
        SEND_FAILED
    }

    /** A limit that blocks a request until {@code nextAllowedAt}. */
    public record Limit(Refusal reason, Instant nextAllowedAt) {
    }

    private CallPermissionPolicy() {
    }

    public static State state(CallPermission permission, Instant lastRequestAt, Instant now) {
        if (permission.active(now)) {
            return State.CAN_CALL;
        }
        boolean unanswered = lastRequestAt != null
                && lastRequestAt.isAfter(now.minus(REQUEST_EXPIRY))
                && (permission.respondedAt() == null || lastRequestAt.isAfter(permission.respondedAt()));
        return unanswered ? State.PENDING : State.NO_PERMISSION;
    }

    /**
     * The limit a new request would break, given when the previous ones were sent. A connected call resets
     * both counters, so requests before it do not count.
     */
    public static Optional<Limit> limit(List<Instant> sentAt, Instant lastConnectedCallAt, Instant now) {
        List<Instant> counted = sentAt.stream()
                .filter(t -> lastConnectedCallAt == null || t.isAfter(lastConnectedCallAt))
                .sorted()
                .toList();
        Optional<Limit> daily = window(counted, now, DAY, DAILY_MAX, Refusal.DAILY_LIMIT);
        Optional<Limit> weekly = window(counted, now, WEEK, WEEKLY_MAX, Refusal.WEEKLY_LIMIT);
        if (daily.isPresent() && weekly.isPresent()) {
            return weekly.get().nextAllowedAt().isAfter(daily.get().nextAllowedAt()) ? weekly : daily;
        }
        return daily.isPresent() ? daily : weekly;
    }

    private static Optional<Limit> window(List<Instant> sorted, Instant now, Duration length, int max,
            Refusal reason) {
        List<Instant> inside = sorted.stream().filter(t -> t.isAfter(now.minus(length))).toList();
        if (inside.size() < max) {
            return Optional.empty();
        }
        return Optional.of(new Limit(reason, inside.get(inside.size() - max).plus(length)));
    }

    /** The permission after the contact's reply. A reply older than the last one stored changes nothing. */
    public static CallPermission onReply(CallPermission current, CallPermissionReply reply, Instant now) {
        Instant at = instant(reply.timestamp(), now);
        if (current.respondedAt() != null && at.isBefore(current.respondedAt())) {
            return current;
        }
        if (reply.accepted()) {
            Instant expires = reply.permanent() ? null : instant(reply.expiresAt(), at.plus(TEMPORARY_PERMISSION));
            return new CallPermission(current.businessPhoneNumberId(), current.contactE164(),
                    reply.permanent() ? CallPermissionStatus.PERMANENT : CallPermissionStatus.TEMPORARY, expires, at,
                    reply.responseSource(), 0, current.lastConnectedCallAt());
        }
        boolean hadGranted = current.status() == CallPermissionStatus.TEMPORARY
                || current.status() == CallPermissionStatus.PERMANENT
                || current.status() == CallPermissionStatus.REVOKED;
        return new CallPermission(current.businessPhoneNumberId(), current.contactE164(),
                hadGranted ? CallPermissionStatus.REVOKED : CallPermissionStatus.DECLINED, null, at,
                reply.responseSource(), current.consecutiveUnanswered(), current.lastConnectedCallAt());
    }

    /**
     * The permission after a call ends. A connected call clears the unanswered count; an unanswered
     * business-initiated call adds one, and the {@value #UNANSWERED_REVOKE}th in a row revokes the permission.
     */
    public static CallPermission onCall(CallPermission current, CallEvent call, Instant now) {
        if (!call.terminated()) {
            return current;
        }
        Instant at = instant(call.timestamp(), now);
        if (call.connected()) {
            Instant last = current.lastConnectedCallAt() == null || at.isAfter(current.lastConnectedCallAt())
                    ? at : current.lastConnectedCallAt();
            return new CallPermission(current.businessPhoneNumberId(), current.contactE164(), current.status(),
                    current.expiresAt(), current.respondedAt(), current.responseSource(), 0, last);
        }
        if (!call.businessInitiated()) {
            return current;
        }
        int unanswered = current.consecutiveUnanswered() + 1;
        if (unanswered >= UNANSWERED_REVOKE && current.active(at)) {
            return new CallPermission(current.businessPhoneNumberId(), current.contactE164(),
                    CallPermissionStatus.REVOKED, null, at, UNANSWERED_CALLS, unanswered,
                    current.lastConnectedCallAt());
        }
        return new CallPermission(current.businessPhoneNumberId(), current.contactE164(), current.status(),
                current.expiresAt(), current.respondedAt(), current.responseSource(), unanswered,
                current.lastConnectedCallAt());
    }

    private static Instant instant(OffsetDateTime at, Instant fallback) {
        return at == null ? fallback : at.toInstant();
    }
}
