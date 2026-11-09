package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.telephony.PstnCall;
import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TeamsCallReconcilerTest {

    @Test
    void aRecordAssignedOnAnEarlierRunCannotBeReused() {
        TreatmentAction first = pendingCall("+56911111111");
        records.add(record("r1", OPERATOR, "+56911111111", CALL_START.plusSeconds(4), 61));
        assertEquals(1, reconciler().reconcile(TENANT, OPERATOR).recorded());
        TreatmentAction second = pendingCall("+56911111111");
        assertEquals(new TeamsCallReconciler.Result(1, 0, 1), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("RECORDED", TeamsCallReconciler.telephony(stored(first.id())).get("status"));
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored(second.id())).get("status"));
    }

    @Test
    void oneRecordMatchingTwoActionsIsAmbiguousAndEventuallyExpires() {
        TreatmentAction first = pendingCall("+56911111111");
        TreatmentAction second = pendingCall("+56911111111");
        records.add(record("r1", OPERATOR, "+56911111111", CALL_START.plusSeconds(4), 61));
        assertEquals(new TeamsCallReconciler.Result(2, 0, 2), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("AMBIGUOUS", TeamsCallReconciler.telephony(stored(first.id())).get("reason"));
        now = CALL_END.plusSeconds(49 * 3600);
        assertEquals(new TeamsCallReconciler.Result(2, 0, 0), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("NOT_FOUND", TeamsCallReconciler.telephony(stored(second.id())).get("status"));
    }

    @Test
    void aStalePendingUpdateCannotReplaceARecordedResult() {
        TreatmentAction call = pendingCall("+56911111111");
        records.add(record("r1", OPERATOR, "+56911111111", CALL_START.plusSeconds(4), 61));
        reconciler().reconcile(TENANT, OPERATOR);
        assertFalse(store.updateCallResult(TENANT, call.id(), null, null, call.details()).isPresent());
        assertEquals("r1", TeamsCallReconciler.telephony(stored(call.id())).get("recordId"));
        assertEquals(61, stored(call.id()).durationSeconds());
    }

    @Test
    void aConfiguredCallerIdCannotMatchAMissingCallerNumber() {
        line = new TelephonyLine("m1", TelephonyProvider.TEAMS_PHONE, "Teams", "+56900000000", true);
        TreatmentAction call = pendingCall("+56911111111");
        records.add(new PstnCall("r1", "call-r1", OPERATOR, null, "+56911111111", CALL_START, CALL_END, 61, "user_out"));
        assertEquals(0, reconciler().reconcile(TENANT, OPERATOR).recorded());
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored(call.id())).get("status"));
    }

    @Test
    void inboundCallsCannotMatchAnOutboundAttempt() {
        pendingCall("+56911111111");
        records.add(new PstnCall("r1", "call-r1", OPERATOR, "+56900000000", "+56911111111", CALL_START, CALL_END, 61, "user_in"));
        assertEquals(0, reconciler().reconcile(TENANT, OPERATOR).recorded());
    }

    @Test
    void aChangedConnectionDoesNotReplaceTheOriginalCallConnection() {
        TreatmentAction call = pendingCall("+56911111111");
        Map<String, Object> original = new java.util.LinkedHashMap<>(TeamsCallReconciler.telephony(call));
        original.put("connectionId", "old-line");
        store.updateCallResult(TENANT, call.id(), null, null, Map.of("telephony", original));
        records.add(record("r1", OPERATOR, "+56911111111", CALL_START.plusSeconds(4), 61));
        assertEquals(0, reconciler().reconcile(TENANT, OPERATOR).recorded());
        assertEquals("old-line", TeamsCallReconciler.telephony(stored(call.id())).get("connectionId"));
    }

    @Test
    void aDirectRoutingRecordFillsDurationAndResult() {
        TreatmentAction call = pendingCall("+56911111111");
        records.add(directRouting("dr1", "+56911111111", "ByotOut", true, 61));

        assertEquals(new TeamsCallReconciler.Result(1, 1, 0), reconciler().reconcile(TENANT, OPERATOR));
        TreatmentAction saved = stored(call.id());
        assertEquals(61, saved.durationSeconds());
        assertEquals(Boolean.TRUE, saved.answered());
        Map<?, ?> t = (Map<?, ?>) saved.details().get("telephony");
        assertEquals("RECORDED", t.get("status"));
        assertEquals("dr1", t.get("recordId"));
        assertEquals("corr-dr1", t.get("callId"));
        assertEquals("DIRECT_ROUTING", t.get("report"));
    }

    @Test
    void aFailedDirectRoutingCallIsRecordedAsNotAnswered() {
        TreatmentAction call = pendingCall("+56911111111");
        records.add(directRouting("dr1", "+56911111111", "ByotOut", false, 0));

        assertEquals(1, reconciler().reconcile(TENANT, OPERATOR).recorded());
        assertEquals(Boolean.FALSE, stored(call.id()).answered());
        assertEquals(0, stored(call.id()).durationSeconds());
    }

    @Test
    void anInboundDirectRoutingCallIsIgnored() {
        TreatmentAction call = pendingCall("+56911111111");
        records.add(directRouting("dr1", "+56911111111", "ByotIn", true, 61));

        assertEquals(0, reconciler().reconcile(TENANT, OPERATOR).recorded());
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored(call.id())).get("status"));
    }

    @Test
    void bothReportsServeTheirOwnCalls() {
        TreatmentAction pstn = pendingCall("+56911111111");
        TreatmentAction direct = pendingCall("+56933333333");
        records.add(record("p1", OPERATOR, "+56911111111", CALL_START.plusSeconds(4), 42));
        records.add(directRouting("dr1", "+56933333333", "ByotOutUserForwarding", true, 17));
        records.add(directRouting("dr2", "+56911111111", "ByotIn", true, 99));

        assertEquals(new TeamsCallReconciler.Result(2, 2, 0), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals(42, stored(pstn.id()).durationSeconds());
        assertEquals("p1", TeamsCallReconciler.telephony(stored(pstn.id())).get("recordId"));
        assertEquals(17, stored(direct.id()).durationSeconds());
        assertEquals("dr1", TeamsCallReconciler.telephony(stored(direct.id())).get("recordId"));
    }

    private static PstnCall directRouting(String id, String callee, String type, boolean success, int seconds) {
        Instant start = CALL_START.plusSeconds(6);
        return new PstnCall(id, "corr-" + id, OPERATOR, "+56900000000", callee, start, start.plusSeconds(seconds),
                seconds, type, success, PstnCall.Report.DIRECT_ROUTING);
    }

    private static final String TENANT = "acme";
    private static final String OPERATOR = "ana@example.com";
    private static final Instant CALL_START = Instant.parse("2026-11-04T10:00:00Z");
    private static final Instant CALL_END = Instant.parse("2026-11-04T10:01:30Z");

    private final InMemoryTreatmentStore store = new InMemoryTreatmentStore();
    private final List<PstnCall> records = new ArrayList<>();
    private final List<Instant[]> asked = new ArrayList<>();
    private TelephonyLine line = new TelephonyLine("m1", TelephonyProvider.TEAMS_PHONE, "Teams", null, true);
    private Instant now = CALL_END.plusSeconds(300);
    private String treatmentId;

    private final Telephony telephony = new Telephony() {
        @Override
        public List<TelephonyLine> lines(String tenantCode) {
            return line == null ? List.of() : List.of(line);
        }

        @Override
        public List<PstnCall> pstnCalls(String tenantCode, String connectionId, Instant from, Instant to) {
            asked.add(new Instant[] {from, to});
            return List.copyOf(records);
        }
    };

    private TeamsCallReconciler reconciler() {
        return new TeamsCallReconciler(store, telephony, new AuditService(new InMemoryAuditStore()),
                Clock.fixed(now, ZoneOffset.UTC));
    }

    @BeforeEach
    void openTreatment() {
        OffsetDateTime opened = OffsetDateTime.ofInstant(CALL_START.minusSeconds(60), ZoneOffset.UTC);
        Treatment t = store.insert(new Treatment(null, TENANT, 7L, null, null, TreatmentType.CALL,
                TreatmentStatus.OPEN, OPERATOR, opened, null, null, null, null, opened)).treatment();
        treatmentId = t.id();
    }

    private TreatmentAction pendingCall(String callee) {
        Map<String, Object> telephony = Map.of("provider", "TEAMS_PHONE", "status", "PENDING", "calleeNumber",
                callee, "startedAt", CALL_START.toString(), "endedAt", CALL_END.toString());
        return store.addAction(new TreatmentAction(null, treatmentId, TENANT, 0, ActionKind.CALL, null, "Luis", null,
                callee, CallMethod.PHONE, null, null, null, 90, null, null, List.of(),
                Map.of("telephony", telephony), OPERATOR, OffsetDateTime.ofInstant(CALL_END, ZoneOffset.UTC)));
    }

    private static PstnCall record(String id, String upn, String callee, Instant start, int seconds) {
        return new PstnCall(id, "call-" + id, upn, "+56900000000", callee, start, start.plusSeconds(seconds),
                seconds, "user_out");
    }

    private TreatmentAction stored(String id) {
        return store.listActions(TENANT, List.of(treatmentId)).stream().filter(a -> a.id().equals(id)).findFirst()
                .orElseThrow();
    }

    @Test
    void theOperatorsRecordFillsDurationAndResult() {
        TreatmentAction call = pendingCall("+56911111111");
        records.add(record("other-op", "luis@example.com", "+56911111111", CALL_START.plusSeconds(5), 30));
        records.add(record("r1", "Ana@Example.com", "+56 9 1111 1111", CALL_START.plusSeconds(4), 61));

        TeamsCallReconciler.Result result = reconciler().reconcile(TENANT, OPERATOR);

        assertEquals(new TeamsCallReconciler.Result(1, 1, 0), result);
        TreatmentAction saved = stored(call.id());
        assertEquals(61, saved.durationSeconds());
        assertEquals(Boolean.TRUE, saved.answered());
        Map<?, ?> t = (Map<?, ?>) saved.details().get("telephony");
        assertEquals("RECORDED", t.get("status"));
        assertEquals("r1", t.get("recordId"));
        Instant[] window = asked.get(0);
        assertEquals(CALL_START.minusSeconds(300), window[0]);
        assertEquals(now, window[1], "the window never reaches past now");
    }

    @Test
    void noRecordYetStaysPending() {
        TreatmentAction call = pendingCall("+56911111111");

        assertEquals(new TeamsCallReconciler.Result(1, 0, 1), reconciler().reconcile(TENANT, OPERATOR));
        TreatmentAction saved = stored(call.id());
        assertEquals(90, saved.durationSeconds(), "the timed duration is kept");
        assertNull(saved.answered());
        Map<?, ?> t = (Map<?, ?>) saved.details().get("telephony");
        assertEquals("PENDING", t.get("status"));
        assertEquals(1, t.get("attempts"));
    }

    @Test
    void twoCandidatesStayPendingAsAmbiguous() {
        TreatmentAction call = pendingCall("+56911111111");
        records.add(record("r1", OPERATOR, "+56911111111", CALL_START.plusSeconds(4), 61));
        records.add(record("r2", OPERATOR, "+56911111111", CALL_START.plusSeconds(40), 20));

        assertEquals(new TeamsCallReconciler.Result(1, 0, 1), reconciler().reconcile(TENANT, OPERATOR));
        Map<?, ?> t = (Map<?, ?>) stored(call.id()).details().get("telephony");
        assertEquals("PENDING", t.get("status"));
        assertEquals("AMBIGUOUS", t.get("reason"));
    }

    @Test
    void aRecordWithoutTheOperatorIsNeverTaken() {
        TreatmentAction call = pendingCall("+56911111111");
        records.add(record("r1", null, "+56911111111", CALL_START.plusSeconds(4), 61));
        records.add(record("r2", OPERATOR, "+56911111111", CALL_START.plusSeconds(3600), 61));

        reconciler().reconcile(TENANT, OPERATOR);
        assertEquals("PENDING", ((Map<?, ?>) stored(call.id()).details().get("telephony")).get("status"));
    }

    @Test
    void theLinesCallerIdMustMatchWhenSet() {
        line = new TelephonyLine("m1", TelephonyProvider.TEAMS_PHONE, "Teams", "+56922222222", true);
        TreatmentAction call = pendingCall("+56911111111");
        records.add(record("r1", OPERATOR, "+56911111111", CALL_START.plusSeconds(4), 61));

        reconciler().reconcile(TENANT, OPERATOR);
        assertEquals("PENDING", ((Map<?, ?>) stored(call.id()).details().get("telephony")).get("status"));
    }

    @Test
    void afterTwoDaysWithoutARecordItIsNotFound() {
        TreatmentAction call = pendingCall("+56911111111");
        now = CALL_END.plusSeconds(49 * 3600);

        assertEquals(new TeamsCallReconciler.Result(1, 0, 0), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("NOT_FOUND", ((Map<?, ?>) stored(call.id()).details().get("telephony")).get("status"));
    }

    @Test
    void nothingPendingAsksGraphNothing() {
        assertEquals(new TeamsCallReconciler.Result(0, 0, 0), reconciler().reconcile(TENANT, OPERATOR));
        assertTrue(asked.isEmpty());
    }

    @Test
    void withoutATeamsLineItIsRefused() {
        pendingCall("+56911111111");
        line = null;
        assertThrows(TelephonyUnavailableException.class, () -> reconciler().reconcile(TENANT, OPERATOR));
    }
}
