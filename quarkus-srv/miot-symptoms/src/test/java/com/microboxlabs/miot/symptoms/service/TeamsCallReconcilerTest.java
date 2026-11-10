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
import com.microboxlabs.miot.core.telephony.TelephonyThrottledException;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TeamsCallReconcilerTest {

    @Test
    void concurrentRequestsObserveTheFirstThrottledResponse() throws Exception {
        pendingCall("+12025550101");
        var calls = new AtomicInteger();
        var lineReads = new AtomicInteger();
        var firstStarted = new CountDownLatch(1);
        var secondReady = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        Telephony slowGraph = new Telephony() {
            @Override
            public List<TelephonyLine> lines(String tenantCode) {
                if (lineReads.incrementAndGet() == 2) {
                    secondReady.countDown();
                }
                return List.of(line);
            }

            @Override
            public List<PstnCall> pstnCalls(String tenantCode, String connectionId, Instant from, Instant to) {
                if (calls.incrementAndGet() == 1) {
                    firstStarted.countDown();
                    try {
                        assertTrue(release.await(5, TimeUnit.SECONDS));
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(e);
                    }
                }
                throw new TelephonyThrottledException("Graph returned HTTP 429", Duration.ofMinutes(1));
            }
        };
        var service = new TeamsCallReconciler(store, slowGraph, new AuditService(new InMemoryAuditStore()),
                Clock.fixed(now, ZoneOffset.UTC));
        var requests = Executors.newFixedThreadPool(2);
        try {
            var first = requests.submit(() -> service.reconcile(TENANT, OPERATOR));
            assertTrue(firstStarted.await(5, TimeUnit.SECONDS));
            var second = requests.submit(() -> service.reconcile(TENANT, OPERATOR));
            assertTrue(secondReady.await(5, TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> second.get(200, TimeUnit.MILLISECONDS),
                    "the second lookup waits for the first response before checking the pause");
            release.countDown();
            assertTrue(assertThrows(ExecutionException.class, () -> first.get(5, TimeUnit.SECONDS))
                    .getCause() instanceof TelephonyThrottledException);
            assertTrue(assertThrows(ExecutionException.class, () -> second.get(5, TimeUnit.SECONDS))
                    .getCause() instanceof TelephonyThrottledException);
            assertEquals(1, calls.get(), "a queued request must not call Graph during Retry-After");
        } finally {
            release.countDown();
            requests.shutdownNow();
            assertTrue(requests.awaitTermination(5, TimeUnit.SECONDS));
        }
    }

    @Test
    void aRecordAssignedOnAnEarlierRunCannotBeReused() {
        TreatmentAction first = pendingCall("+12025550101");
        records.add(record("r1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 61));
        assertEquals(1, reconciler().reconcile(TENANT, OPERATOR).recorded());
        TreatmentAction second = pendingCall("+12025550101");
        assertEquals(new TeamsCallReconciler.Result(1, 0, 1), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("RECORDED", TeamsCallReconciler.telephony(stored(first.id())).get("status"));
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored(second.id())).get("status"));
    }

    @Test
    void oneRecordMatchingTwoActionsIsAmbiguousAndEventuallyExpires() {
        TreatmentAction first = pendingCall("+12025550101");
        TreatmentAction second = pendingCall("+12025550101");
        records.add(record("r1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 61));
        assertEquals(new TeamsCallReconciler.Result(2, 0, 2), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("AMBIGUOUS", TeamsCallReconciler.telephony(stored(first.id())).get("reason"));
        now = CALL_END.plusSeconds(49 * 3600);
        assertEquals(new TeamsCallReconciler.Result(2, 0, 0), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("NOT_FOUND", TeamsCallReconciler.telephony(stored(second.id())).get("status"));
    }

    @Test
    void aStalePendingUpdateCannotReplaceARecordedResult() {
        TreatmentAction call = pendingCall("+12025550101");
        records.add(record("r1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 61));
        reconciler().reconcile(TENANT, OPERATOR);
        assertFalse(store.updateCallResult(TENANT, call.id(), null, null, call.details()).isPresent());
        assertEquals("r1", TeamsCallReconciler.telephony(stored(call.id())).get("recordId"));
        assertEquals(61, stored(call.id()).durationSeconds());
    }

    @Test
    void aConfiguredCallerIdCannotMatchAMissingCallerNumber() {
        line = new TelephonyLine("m1", TelephonyProvider.TEAMS_PHONE, "Teams", "+12025550100", true);
        TreatmentAction call = pendingCall("+12025550101");
        records.add(new PstnCall("r1", "call-r1", OPERATOR, null, "+12025550101", CALL_START, CALL_END, 61, "user_out"));
        assertEquals(0, reconciler().reconcile(TENANT, OPERATOR).recorded());
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored(call.id())).get("status"));
    }

    @Test
    void inboundCallsCannotMatchAnOutboundAttempt() {
        pendingCall("+12025550101");
        records.add(new PstnCall("r1", "call-r1", OPERATOR, "+12025550100", "+12025550101", CALL_START, CALL_END, 61, "user_in"));
        assertEquals(0, reconciler().reconcile(TENANT, OPERATOR).recorded());
    }

    @Test
    void aChangedConnectionDoesNotReplaceTheOriginalCallConnection() {
        TreatmentAction call = pendingCall("+12025550101");
        Map<String, Object> original = new java.util.LinkedHashMap<>(TeamsCallReconciler.telephony(call));
        original.put("connectionId", "old-line");
        store.updateCallResult(TENANT, call.id(), null, null, Map.of("telephony", original));
        records.add(record("r1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 61));
        assertEquals(0, reconciler().reconcile(TENANT, OPERATOR).recorded());
        assertEquals("old-line", TeamsCallReconciler.telephony(stored(call.id())).get("connectionId"));
    }

    @Test
    void aDirectRoutingRecordFillsDurationAndResult() {
        TreatmentAction call = pendingCall("+12025550101");
        records.add(directRouting("dr1", "+12025550101", "ByotOut", true, 61));

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
        TreatmentAction call = pendingCall("+12025550101");
        records.add(directRouting("dr1", "+12025550101", "ByotOut", false, 0));

        assertEquals(1, reconciler().reconcile(TENANT, OPERATOR).recorded());
        assertEquals(Boolean.FALSE, stored(call.id()).answered());
        assertEquals(0, stored(call.id()).durationSeconds());
    }

    @Test
    void anInboundDirectRoutingCallIsIgnored() {
        TreatmentAction call = pendingCall("+12025550101");
        records.add(directRouting("dr1", "+12025550101", "ByotIn", true, 61));

        assertEquals(0, reconciler().reconcile(TENANT, OPERATOR).recorded());
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored(call.id())).get("status"));
    }

    @Test
    void bothReportsServeTheirOwnCalls() {
        TreatmentAction pstn = pendingCall("+12025550101");
        TreatmentAction direct = pendingCall("+12025550103");
        records.add(record("p1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 42));
        records.add(directRouting("dr1", "+12025550103", "ByotOutUserForwarding", true, 17));
        records.add(directRouting("dr2", "+12025550101", "ByotIn", true, 99));

        assertEquals(new TeamsCallReconciler.Result(2, 2, 0), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals(42, stored(pstn.id()).durationSeconds());
        assertEquals("p1", TeamsCallReconciler.telephony(stored(pstn.id())).get("recordId"));
        assertEquals(17, stored(direct.id()).durationSeconds());
        assertEquals("dr1", TeamsCallReconciler.telephony(stored(direct.id())).get("recordId"));
    }

    @Test
    void pstnForwardingAndConferenceRecordsMatch() {
        TreatmentAction forwarded = pendingCall("+12025550101");
        TreatmentAction conference = pendingCall("+12025550103");
        TreatmentAction inbound = pendingCall("+12025550104");
        records.add(typed(record("f1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 42),
                "user_out_forwarding"));
        records.add(typed(record("c1", OPERATOR, "+12025550103", CALL_START.plusSeconds(5), 17), "user_out_conf"));
        records.add(typed(record("i1", OPERATOR, "+12025550104", CALL_START.plusSeconds(6), 30), "user_in"));

        assertEquals(new TeamsCallReconciler.Result(3, 2, 1), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("f1", TeamsCallReconciler.telephony(stored(forwarded.id())).get("recordId"));
        assertEquals("c1", TeamsCallReconciler.telephony(stored(conference.id())).get("recordId"));
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored(inbound.id())).get("status"));
    }

    private static PstnCall typed(PstnCall r, String type) {
        return new PstnCall(r.id(), r.callId(), r.userPrincipalName(), r.callerNumber(), r.calleeNumber(), r.start(),
                r.end(), r.durationSeconds(), type);
    }

    private static PstnCall directRouting(String id, String callee, String type, boolean success, int seconds) {
        Instant start = CALL_START.plusSeconds(6);
        return new PstnCall(id, "corr-" + id, OPERATOR, "+12025550100", callee, start, start.plusSeconds(seconds),
                seconds, type, success, PstnCall.Report.DIRECT_ROUTING);
    }

    private static final String TENANT = "acme";
    private static final String OPERATOR = "operator1@example.test";
    private static final Instant CALL_START = Instant.parse("2026-11-04T10:00:00Z");
    private static final Instant CALL_END = Instant.parse("2026-11-04T10:01:30Z");

    private final InMemoryTreatmentStore store = new InMemoryTreatmentStore();
    private final List<PstnCall> records = new ArrayList<>();
    private final List<Instant[]> asked = new ArrayList<>();
    private TelephonyLine line = new TelephonyLine("m1", TelephonyProvider.TEAMS_PHONE, "Teams", null, true);
    private Instant now = CALL_END.plusSeconds(300);
    private String treatmentId;
    private Duration maximumWindow;
    private boolean everyLookupTooLarge;
    private int refuseRequest;

    private final Telephony telephony = new Telephony() {
        @Override
        public List<TelephonyLine> lines(String tenantCode) {
            return line == null ? List.of() : List.of(line);
        }

        @Override
        public List<PstnCall> pstnCalls(String tenantCode, String connectionId, Instant from, Instant to) {
            asked.add(new Instant[] {from, to});
            if (asked.size() == refuseRequest) {
                throw new TelephonyUnavailableException("Graph returned HTTP 403");
            }
            if (everyLookupTooLarge || maximumWindow != null && Duration.between(from, to).compareTo(maximumWindow) > 0) {
                throw new TelephonyUnavailableException(TelephonyUnavailableException.CALL_RECORDS_PAGE_LIMIT,
                        "Report page limit");
            }
            if (maximumWindow != null) {
                return records.stream().filter(r -> !r.start().isBefore(from) && withinReportEnd(r, to)).toList();
            }
            return List.copyOf(records);
        }
    };

    private static boolean withinReportEnd(PstnCall call, Instant to) {
        return call.report() == PstnCall.Report.PSTN ? !call.start().isAfter(to) : call.start().isBefore(to);
    }

    private TeamsCallReconciler reconciler() {
        return new TeamsCallReconciler(store, telephony, new AuditService(new InMemoryAuditStore()),
                Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void anOversizedSharedWindowIsReadAsSmallerCompleteWindows() {
        TreatmentAction first = pendingCall("+12025550101");
        TreatmentAction second = pendingCall("+12025550102");
        records.add(record("r1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 61));
        records.add(record("r2", OPERATOR, "+12025550102", CALL_START.plusSeconds(50), 12));
        maximumWindow = Duration.ofMinutes(6);

        assertEquals(new TeamsCallReconciler.Result(2, 2, 0), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals(3, asked.size());
        assertEquals("r1", TeamsCallReconciler.telephony(stored(first.id())).get("recordId"));
        assertEquals("r2", TeamsCallReconciler.telephony(stored(second.id())).get("recordId"));
    }

    @Test
    void candidatesOnBothSidesOfASplitRemainAmbiguous() {
        TreatmentAction action = pendingCall("+12025550101");
        records.add(record("r1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 61));
        records.add(record("r2", OPERATOR, "+12025550101", CALL_START.plusSeconds(50), 12));
        maximumWindow = Duration.ofMinutes(6);

        assertEquals(new TeamsCallReconciler.Result(1, 0, 1), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("AMBIGUOUS", TeamsCallReconciler.telephony(stored(action.id())).get("reason"));
    }

    @Test
    void aPstnRecordAtTheInclusiveSplitBoundaryMatchesOnce() {
        TreatmentAction action = pendingCall("+12025550101");
        records.add(record("boundary", OPERATOR, "+12025550101", CALL_START.plusSeconds(45), 20));
        maximumWindow = Duration.ofMinutes(6);

        assertEquals(new TeamsCallReconciler.Result(1, 1, 0), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals(3, asked.size());
        assertEquals("boundary", TeamsCallReconciler.telephony(stored(action.id())).get("recordId"));
    }

    @Test
    void splitDeduplicationDoesNotCollapseDifferentReports() {
        TreatmentAction action = pendingCall("+12025550101");
        Instant boundary = CALL_START.plusSeconds(45);
        records.add(record("same-id", OPERATOR, "+12025550101", boundary, 20));
        records.add(new PstnCall("same-id", "corr-direct", OPERATOR, "+12025550100", "+12025550101",
                boundary, boundary.plusSeconds(20), 20, "ByotOut", true, PstnCall.Report.DIRECT_ROUTING));
        maximumWindow = Duration.ofMinutes(6);

        assertEquals(new TeamsCallReconciler.Result(1, 0, 1), reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("AMBIGUOUS", TeamsCallReconciler.telephony(stored(action.id())).get("reason"));
    }

    @Test
    void aFailedSubwindowCannotAssignRecordsFromTheCompletedHalf() {
        TreatmentAction action = pendingCall("+12025550101");
        records.add(record("r1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 61));
        maximumWindow = Duration.ofMinutes(6);
        refuseRequest = 3;

        assertThrows(TelephonyUnavailableException.class, () -> reconciler().reconcile(TENANT, OPERATOR));
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored(action.id())).get("status"));
        assertEquals(3, asked.size());
    }

    @Test
    void aPersistentlyOversizedReportHasABoundedRequestCount() {
        TreatmentAction action = pendingCall("+12025550101");
        everyLookupTooLarge = true;

        TelephonyUnavailableException failure = assertThrows(TelephonyUnavailableException.class,
                () -> reconciler().reconcile(TENANT, OPERATOR));
        assertEquals(TelephonyUnavailableException.CALL_RECORDS_PAGE_LIMIT, failure.code());
        assertTrue(asked.size() <= TeamsCallReconciler.MAX_REPORT_LOOKUPS);
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored(action.id())).get("status"));
    }

    @Test
    void authenticationErrorsAreNotRetriedAsSmallerWindows() {
        pendingCall("+12025550101");
        refuseRequest = 1;

        assertThrows(TelephonyUnavailableException.class, () -> reconciler().reconcile(TENANT, OPERATOR));
        assertEquals(1, asked.size());
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
        return new PstnCall(id, "call-" + id, upn, "+12025550100", callee, start, start.plusSeconds(seconds),
                seconds, "user_out");
    }

    private TreatmentAction stored(String id) {
        return store.listActions(TENANT, List.of(treatmentId)).stream().filter(a -> a.id().equals(id)).findFirst()
                .orElseThrow();
    }

    @Test
    void theOperatorsRecordFillsDurationAndResult() {
        TreatmentAction call = pendingCall("+12025550101");
        records.add(record("other-op", "operator2@example.test", "+12025550101", CALL_START.plusSeconds(5), 30));
        records.add(record("r1", "Operator1@Example.Test", "+1 (202) 555-0101", CALL_START.plusSeconds(4), 61));

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
        TreatmentAction call = pendingCall("+12025550101");

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
        TreatmentAction call = pendingCall("+12025550101");
        records.add(record("r1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 61));
        records.add(record("r2", OPERATOR, "+12025550101", CALL_START.plusSeconds(40), 20));

        assertEquals(new TeamsCallReconciler.Result(1, 0, 1), reconciler().reconcile(TENANT, OPERATOR));
        Map<?, ?> t = (Map<?, ?>) stored(call.id()).details().get("telephony");
        assertEquals("PENDING", t.get("status"));
        assertEquals("AMBIGUOUS", t.get("reason"));
    }

    @Test
    void aRecordWithoutTheOperatorIsNeverTaken() {
        TreatmentAction call = pendingCall("+12025550101");
        records.add(record("r1", null, "+12025550101", CALL_START.plusSeconds(4), 61));
        records.add(record("r2", OPERATOR, "+12025550101", CALL_START.plusSeconds(3600), 61));

        reconciler().reconcile(TENANT, OPERATOR);
        assertEquals("PENDING", ((Map<?, ?>) stored(call.id()).details().get("telephony")).get("status"));
    }

    @Test
    void theLinesCallerIdMustMatchWhenSet() {
        line = new TelephonyLine("m1", TelephonyProvider.TEAMS_PHONE, "Teams", "+12025550102", true);
        TreatmentAction call = pendingCall("+12025550101");
        records.add(record("r1", OPERATOR, "+12025550101", CALL_START.plusSeconds(4), 61));

        reconciler().reconcile(TENANT, OPERATOR);
        assertEquals("PENDING", ((Map<?, ?>) stored(call.id()).details().get("telephony")).get("status"));
    }

    @Test
    void afterTwoDaysWithoutARecordItIsNotFound() {
        TreatmentAction call = pendingCall("+12025550101");
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
        pendingCall("+12025550101");
        line = null;
        assertThrows(TelephonyUnavailableException.class, () -> reconciler().reconcile(TENANT, OPERATOR));
    }
}
