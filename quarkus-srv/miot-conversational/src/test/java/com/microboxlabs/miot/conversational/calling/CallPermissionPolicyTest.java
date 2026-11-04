package com.microboxlabs.miot.conversational.calling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy.Refusal;
import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy.State;
import com.microboxlabs.miot.conversational.service.CallEvent;
import com.microboxlabs.miot.conversational.service.CallPermissionReply;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class CallPermissionPolicyTest {

    private static final Instant NOW = Instant.parse("2026-11-04T12:00:00Z");
    private static final String NUMBER = "PNID";
    private static final String CONTACT = "+56900000001";

    @Test
    void oneRequestPerDay() {
        Instant sent = NOW.minus(Duration.ofHours(3));
        var limit = CallPermissionPolicy.limit(List.of(sent), null, NOW).orElseThrow();
        assertEquals(Refusal.DAILY_LIMIT, limit.reason());
        assertEquals(sent.plus(Duration.ofHours(24)), limit.nextAllowedAt());
        assertTrue(CallPermissionPolicy.limit(List.of(NOW.minus(Duration.ofHours(25))), null, NOW).isEmpty());
    }

    @Test
    void twoRequestsPerWeek() {
        Instant first = NOW.minus(Duration.ofDays(6));
        Instant second = NOW.minus(Duration.ofDays(2));
        var limit = CallPermissionPolicy.limit(List.of(second, first), null, NOW).orElseThrow();
        assertEquals(Refusal.WEEKLY_LIMIT, limit.reason());
        assertEquals(first.plus(Duration.ofDays(7)), limit.nextAllowedAt());
        assertTrue(CallPermissionPolicy.limit(List.of(NOW.minus(Duration.ofDays(8)), second), null, NOW)
                .isEmpty());
    }

    @Test
    void theLaterLimitWinsWhenBothApply() {
        Instant first = NOW.minus(Duration.ofDays(5));
        Instant second = NOW.minus(Duration.ofHours(1));
        var limit = CallPermissionPolicy.limit(List.of(first, second), null, NOW).orElseThrow();
        assertEquals(Refusal.WEEKLY_LIMIT, limit.reason());
        assertEquals(first.plus(Duration.ofDays(7)), limit.nextAllowedAt());
    }

    @Test
    void aConnectedCallResetsTheCounters() {
        Instant sent = NOW.minus(Duration.ofHours(3));
        assertTrue(CallPermissionPolicy.limit(List.of(sent), NOW.minus(Duration.ofHours(1)), NOW).isEmpty());
    }

    @Test
    void stateFollowsTheGrantAndTheLastRequest() {
        CallPermission none = CallPermission.none(NUMBER, CONTACT);
        assertEquals(State.NO_PERMISSION, CallPermissionPolicy.state(none, null, NOW));
        assertEquals(State.PENDING, CallPermissionPolicy.state(none, NOW.minus(Duration.ofDays(1)), NOW));
        assertEquals(State.NO_PERMISSION, CallPermissionPolicy.state(none, NOW.minus(Duration.ofDays(8)), NOW));

        CallPermission temporary = CallPermissionPolicy.onReply(none, reply(true, false, NOW.plus(Duration.ofDays(7))),
                NOW);
        assertEquals(State.CAN_CALL, CallPermissionPolicy.state(temporary, NOW.minus(Duration.ofDays(1)), NOW));
        assertEquals(State.NO_PERMISSION,
                CallPermissionPolicy.state(temporary, null, NOW.plus(Duration.ofDays(8))));

        CallPermission declined = CallPermissionPolicy.onReply(none, reply(false, false, null), NOW);
        assertEquals(CallPermissionStatus.DECLINED, declined.status());
        // A request sent after the rejection is pending again.
        assertEquals(State.PENDING, CallPermissionPolicy.state(declined, NOW.plus(Duration.ofHours(30)),
                NOW.plus(Duration.ofHours(31))));
    }

    @Test
    void repliesSetTheStatus() {
        CallPermission none = CallPermission.none(NUMBER, CONTACT);
        CallPermission permanent = CallPermissionPolicy.onReply(none, reply(true, true, null), NOW);
        assertEquals(CallPermissionStatus.PERMANENT, permanent.status());
        assertNull(permanent.expiresAt());

        CallPermission noExpiry = CallPermissionPolicy.onReply(none, reply(true, false, null), NOW);
        assertEquals(NOW.plus(Duration.ofDays(7)), noExpiry.expiresAt());

        CallPermission revoked = CallPermissionPolicy.onReply(permanent,
                reply(false, false, null, NOW.plus(Duration.ofMinutes(1))), NOW);
        assertEquals(CallPermissionStatus.REVOKED, revoked.status());

        // An older reply than the one stored changes nothing.
        assertEquals(revoked, CallPermissionPolicy.onReply(revoked, reply(true, true, null,
                NOW.minus(Duration.ofDays(1))), NOW));
    }

    @Test
    void fourUnansweredCallsInARowRevoke() {
        CallPermission p = CallPermissionPolicy.onReply(CallPermission.none(NUMBER, CONTACT),
                reply(true, true, null), NOW);
        for (int i = 0; i < 3; i++) {
            p = CallPermissionPolicy.onCall(p, call(false, CallEvent.BUSINESS_INITIATED), NOW);
        }
        assertEquals(3, p.consecutiveUnanswered());
        assertEquals(CallPermissionStatus.PERMANENT, p.status());

        CallPermission answered = CallPermissionPolicy.onCall(p, call(true, CallEvent.BUSINESS_INITIATED), NOW);
        assertEquals(0, answered.consecutiveUnanswered());
        assertEquals(NOW, answered.lastConnectedCallAt());

        CallPermission fourth = CallPermissionPolicy.onCall(p, call(false, CallEvent.BUSINESS_INITIATED), NOW);
        assertEquals(CallPermissionStatus.REVOKED, fourth.status());
        assertEquals(CallPermissionPolicy.UNANSWERED_CALLS, fourth.responseSource());
    }

    @Test
    void aMissedUserCallAndAConnectEventChangeNothing() {
        CallPermission p = CallPermission.none(NUMBER, CONTACT);
        assertEquals(p, CallPermissionPolicy.onCall(p, call(false, "USER_INITIATED"), NOW));
        CallEvent connect = new CallEvent(NUMBER, "wacid.1", CONTACT, "connect", CallEvent.BUSINESS_INITIATED, null,
                false, null);
        assertEquals(p, CallPermissionPolicy.onCall(p, connect, NOW));
    }

    private static CallPermissionReply reply(boolean accepted, boolean permanent, Instant expires) {
        return reply(accepted, permanent, expires, NOW);
    }

    private static CallPermissionReply reply(boolean accepted, boolean permanent, Instant expires, Instant at) {
        return new CallPermissionReply(NUMBER, CONTACT, "wamid.R", "wamid.Q", accepted, permanent,
                expires == null ? null : expires.atOffset(ZoneOffset.UTC), "user_action",
                at.atOffset(ZoneOffset.UTC));
    }

    private static CallEvent call(boolean connected, String direction) {
        return new CallEvent(NUMBER, "wacid.1", CONTACT, CallEvent.TERMINATE, direction, "COMPLETED", connected,
                OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC));
    }
    @Test
    void disconnectedFailedCallsDoNotProveTheContactLeftCallsUnanswered() {
        var permission = CallPermissionPolicy.onReply(CallPermission.none(NUMBER, CONTACT), reply(true, true, null), NOW);
        var failed = new CallEvent(NUMBER, "failed", CONTACT, CallEvent.TERMINATE, CallEvent.BUSINESS_INITIATED,
                "FAILED", false, NOW.atOffset(ZoneOffset.UTC));
        for (int i = 0; i < 4; i++) permission = CallPermissionPolicy.onCall(permission, failed, NOW);
        assertEquals(CallPermissionStatus.PERMANENT, permission.status());
        assertEquals(0, permission.consecutiveUnanswered());
    }

}
