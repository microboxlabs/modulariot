package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import com.microboxlabs.miot.symptoms.store.TreatmentStore.Caller;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class TeamsCallReconcileJobTest {

    private static final Instant CALL_START = Instant.parse("2026-11-04T10:00:00Z");
    private static final Instant CALL_END = Instant.parse("2026-11-04T10:01:30Z");
    private static final Instant NOW = CALL_END.plusSeconds(1800);

    private final InMemoryTreatmentStore store = new InMemoryTreatmentStore();
    private final Map<String, TelephonyLine> lines = new HashMap<>();
    private final List<PstnCall> records = new ArrayList<>();
    private final List<String> graphAsked = new ArrayList<>();
    private boolean lockHeld;
    private int locked;
    private boolean graphFails;

    private final Telephony telephony = new Telephony() {
        @Override
        public List<TelephonyLine> lines(String tenantCode) {
            TelephonyLine line = lines.get(tenantCode);
            return line == null ? List.of() : List.of(line);
        }

        @Override
        public List<PstnCall> pstnCalls(String tenantCode, String connectionId, Instant from, Instant to) {
            graphAsked.add(tenantCode);
            if (graphFails) {
                throw new TelephonyUnavailableException("Graph returned HTTP 429");
            }
            return List.copyOf(records);
        }
    };

    private TeamsCallReconcileJob job() {
        return job(true);
    }

    private TeamsCallReconcileJob job(boolean enabled) {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        TeamsCallReconciler reconciler = new TeamsCallReconciler(store, telephony,
                new AuditService(new InMemoryAuditStore()), clock);
        return new TeamsCallReconcileJob(enabled, store, telephony, reconciler, work -> {
            locked++;
            return lockHeld ? Optional.empty() : Optional.ofNullable(work.get());
        }, clock);
    }

    @Test
    void reconcilesThePendingCallsOfEveryOperator() {
        lines.put("acme", teamsLine());
        TreatmentAction ana = pendingCall("acme", "operator1@example.test", "+12025550101");
        TreatmentAction luis = pendingCall("acme", "operator2@example.test", "+12025550102");
        records.add(callRecord("r1", "operator1@example.test", "+12025550101", 61));
        records.add(callRecord("r2", "operator2@example.test", "+12025550102", 12));

        TeamsCallReconcileJob.Run run = job().run();

        assertEquals(new TeamsCallReconcileJob.Run(1, 2, 2, 0), run);
        assertEquals(List.of("acme"), graphAsked, "operators share one complete tenant lookup");
        assertEquals("RECORDED", TeamsCallReconciler.telephony(stored("acme", ana)).get("status"));
        assertEquals(61, stored("acme", ana).durationSeconds());
        assertEquals("r2", TeamsCallReconciler.telephony(stored("acme", luis)).get("recordId"));
    }

    @Test
    void aRecordOfAnotherOperatorIsNotTaken() {
        lines.put("acme", teamsLine());
        TreatmentAction ana = pendingCall("acme", "operator1@example.test", "+12025550101");
        records.add(callRecord("r1", "operator2@example.test", "+12025550101", 61));

        assertEquals(new TeamsCallReconcileJob.Run(1, 1, 0, 0), job().run());
        assertEquals("PENDING", TeamsCallReconciler.telephony(stored("acme", ana)).get("status"));
    }

    @Test
    void twoOperatorsCallingTheSameNumberMatchTheirOwnRecords() {
        lines.put("acme", teamsLine());
        TreatmentAction first = pendingCall("acme", "operator1@example.test", "+12025550101");
        TreatmentAction second = pendingCall("acme", "operator2@example.test", "+12025550101");
        records.add(callRecord("r1", "operator1@example.test", "+12025550101", 61));
        records.add(callRecord("r2", "operator2@example.test", "+12025550101", 12));

        assertEquals(new TeamsCallReconcileJob.Run(1, 2, 2, 0), job().run());
        assertEquals("r1", TeamsCallReconciler.telephony(stored("acme", first)).get("recordId"));
        assertEquals("r2", TeamsCallReconciler.telephony(stored("acme", second)).get("recordId"));
        assertEquals(List.of("acme"), graphAsked);
    }

    @Test
    void nothingPendingEndsBeforeTheLockAndGraph() {
        lines.put("acme", teamsLine());

        assertEquals(new TeamsCallReconcileJob.Run(0, 0, 0, 0), job().run());
        assertEquals(0, locked);
        assertTrue(graphAsked.isEmpty());
    }

    @Test
    void organizationsWithoutAReadyTeamsLineAreSkipped() {
        lines.put("acme", teamsLine());
        lines.put("globex", new TelephonyLine("m2", TelephonyProvider.TEAMS_PHONE, "Teams", null, false));
        pendingCall("acme", "operator1@example.test", "+12025550101");
        pendingCall("globex", "operator3@example.test", "+12025550101");
        pendingCall("initech", "operator4@example.test", "+12025550101");
        records.add(callRecord("r1", "operator1@example.test", "+12025550101", 61));

        assertEquals(new TeamsCallReconcileJob.Run(1, 1, 1, 0), job().run());
        assertEquals(List.of("acme"), graphAsked);
    }

    @Test
    void anotherReplicaHoldingTheLockSkipsTheRun() {
        lines.put("acme", teamsLine());
        pendingCall("acme", "operator1@example.test", "+12025550101");
        lockHeld = true;

        assertEquals(new TeamsCallReconcileJob.Run(0, 0, 0, 0), job().run());
        assertTrue(graphAsked.isEmpty());
    }

    @Test
    void aFailedTenantLookupIsNotRetriedForEveryOperator() {
        lines.put("acme", teamsLine());
        for (int i = 0; i < 30; i++) {
            pendingCall("acme", "operator" + i + "@example.test", "+12025550101");
        }
        graphFails = true;

        assertEquals(new TeamsCallReconcileJob.Run(1, 30, 0, 30), job().run());
        assertEquals(List.of("acme"), graphAsked);
    }

    @Test
    void theDisabledScheduleDoesNotQueryOrLock() {
        pendingCall("acme", "operator1@example.test", "+12025550101");

        job(false).scheduled();

        assertEquals(0, locked);
        assertTrue(graphAsked.isEmpty());
    }

    @Test
    void theStoreListsEachPendingTeamsCallerOnce() {
        pendingCall("acme", "operator1@example.test", "+12025550101");
        pendingCall("acme", "operator1@example.test", "+12025550102");
        pendingCall("globex", "operator3@example.test", "+12025550101");

        assertEquals(List.of(new Caller("acme", "operator1@example.test"), new Caller("globex", "operator3@example.test")),
                store.pendingTeamsCallers(OffsetDateTime.ofInstant(NOW.minusSeconds(86_400), ZoneOffset.UTC), 10));
    }

    private static TelephonyLine teamsLine() {
        return new TelephonyLine("m1", TelephonyProvider.TEAMS_PHONE, "Teams", null, true);
    }

    private final Map<String, String> treatments = new HashMap<>();

    private TreatmentAction pendingCall(String tenant, String operator, String callee) {
        String treatmentId = treatments.computeIfAbsent(tenant, t -> {
            OffsetDateTime opened = OffsetDateTime.ofInstant(CALL_START.minusSeconds(60), ZoneOffset.UTC);
            return store.insert(new Treatment(null, t, 7L, null, null, TreatmentType.CALL, TreatmentStatus.OPEN,
                    operator, opened, null, null, null, null, opened)).treatment().id();
        });
        Map<String, Object> callDetails = Map.of("provider", "TEAMS_PHONE", "status", "PENDING", "calleeNumber",
                callee, "startedAt", CALL_START.toString(), "endedAt", CALL_END.toString());
        return store.addAction(new TreatmentAction(null, treatmentId, tenant, 0, ActionKind.CALL, null, "Test contact", null,
                callee, CallMethod.PHONE, null, null, null, 90, null, null, List.of(),
                Map.of("telephony", callDetails), operator, OffsetDateTime.ofInstant(CALL_END, ZoneOffset.UTC)));
    }

    private static PstnCall callRecord(String id, String upn, String callee, int seconds) {
        Instant start = CALL_START.plusSeconds(4);
        return new PstnCall(id, "corr-" + id, upn, "+12025550100", callee, start, start.plusSeconds(seconds),
                seconds, "ByotOut", true, PstnCall.Report.DIRECT_ROUTING);
    }

    private TreatmentAction stored(String tenant, TreatmentAction action) {
        return store.listActions(tenant, List.of(treatments.get(tenant))).stream()
                .filter(a -> a.id().equals(action.id())).findFirst().orElseThrow();
    }
}
