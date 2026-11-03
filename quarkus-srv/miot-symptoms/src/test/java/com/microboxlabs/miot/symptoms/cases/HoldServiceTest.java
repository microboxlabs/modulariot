package com.microboxlabs.miot.symptoms.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.IgnoreHolds;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HoldServiceTest {

    private static final String TENANT = "tenant-a";
    private static final String TRUCK = "DEMO01";
    private static final Instant NOW = Instant.parse("2026-11-03T12:00:00Z");
    private static final UUID SPEEDING = UUID.randomUUID();
    private static final UUID STOP = UUID.randomUUID();

    private final InMemoryEngineCases cases = new InMemoryEngineCases();
    private final InMemoryTreatmentStore treatments = new InMemoryTreatmentStore();
    private final InMemoryAuditStore audit = new InMemoryAuditStore();
    private final FakeHolds holds = new FakeHolds();
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final List<String> forgotten = new ArrayList<>();
    private SymptomSpec.Ignore policy;
    private final HoldService service = new HoldService(cases,
            new EngineCaseService(cases, (t, a, d) -> forgotten.add(a), t -> null, clock), holds,
            new HoldIndex(holds), treatments, new AuditService(audit), (tenant, c) -> policy, clock);

    /** Holds kept in memory; a trip runs while its id is in {@link #live}. */
    static final class FakeHolds implements HoldStore {
        final Map<String, IgnoreHold> open = new HashMap<>();
        final Map<String, Boolean> live = new HashMap<>();

        @Override
        public List<IgnoreHold> open(String tenantCode) {
            return List.copyOf(open.values());
        }

        @Override
        public List<IgnoreHold> open(int limit) {
            return List.copyOf(open.values());
        }

        @Override
        public Optional<IgnoreHold> find(String tenantCode, String treatmentId) {
            return Optional.ofNullable(open.get(treatmentId));
        }

        @Override
        public Optional<Boolean> tripLive(String tenantCode, String tripId, String assetId) {
            return Optional.ofNullable(live.get(tripId));
        }
    }

    private EngineCase engineCase(long id, UUID symptom, String asset, int level, String trip) {
        EngineCase c = new EngineCase(id, symptom, "1.0.0", "Exceso", "speed", asset, NOW.minusSeconds(600), level,
                trip, null, null, null, null, 0, null, null, null);
        cases.add(c);
        return c;
    }

    private Treatment treatment(long caseId) {
        return treatments.insert(new Treatment(null, TENANT, -caseId, TRUCK, null, TreatmentType.IGNORE_CONDITION,
                TreatmentStatus.OPEN, "ops@example.com", null, null, null, null, null, null)).treatment();
    }

    private static AddActionRequest ignore(Integer seconds, Map<String, Object> details, String label, String note) {
        return new AddActionRequest(ActionKind.IGNORE, null, null, null, null, null, "ignore_reason_2", label, null,
                seconds, null, note, null, details);
    }

    private IgnoreHolds.Checked check(long caseId, AddActionRequest req) {
        return service.check(TENANT, treatment(caseId), req);
    }

    @Test
    void aTimedHoldOnTheCaseIsTheDefault() {
        engineCase(1, SPEEDING, TRUCK, 3, null);

        IgnoreHolds.Checked checked = check(1, ignore(300, null, "Zona de sombra GPS conocida", null));

        assertEquals(300, checked.durationSeconds());
        assertEquals("CASE", checked.details().get("scope"));
        assertEquals(false, checked.details().get("until_trip_end"));
        assertEquals(3, checked.details().get("case_level"));
        assertEquals(NOW.plusSeconds(300).toString(), checked.details().get("until"));
    }

    @Test
    void aSymptomThatIsNotAnEngineCaseIsRecordedAsSent() {
        Treatment t = treatments.insert(new Treatment(null, TENANT, 42, TRUCK, null, TreatmentType.IGNORE_CONDITION,
                TreatmentStatus.OPEN, "ops@example.com", null, null, null, null, null, null)).treatment();
        IgnoreHolds.Checked checked = service.check(TENANT, t, ignore(-1, Map.of("x", 1), "x", null));
        assertEquals(-1, checked.durationSeconds());
        assertEquals(Map.of("x", 1), checked.details());
    }

    @Test
    void theDurationIsRequiredAndAtMostADay() {
        engineCase(1, SPEEDING, TRUCK, 1, null);
        AddActionRequest request1 = ignore(null, null, "x", null);
        assertThrows(IllegalArgumentException.class, () -> check(1, request1));
        AddActionRequest request2 = ignore(0, null, "x", null);
        assertThrows(IllegalArgumentException.class, () -> check(1, request2));
        AddActionRequest request3 = ignore(86_401, null, "x", null);
        assertThrows(IllegalArgumentException.class, () -> check(1, request3));
        AddActionRequest request4 = ignore(300, Map.of("scope", "TRIP"), "x", null);
        assertThrows(IllegalArgumentException.class,
                () -> check(1, request4));
    }

    @Test
    void otroNeedsANote() {
        engineCase(1, SPEEDING, TRUCK, 1, null);
        AddActionRequest request5 = ignore(300, null, "Otro (detallar en la nota)",
                " ");
        assertThrows(IllegalArgumentException.class, () -> check(1, request5));
        assertEquals(300, check(1, ignore(300, null, "Otro (detallar en la nota)", "animal en la ruta"))
                .durationSeconds());
    }

    @Test
    void theLevelPolicyIsEnforced() {
        engineCase(1, SPEEDING, TRUCK, 4, null);
        policy = new SymptomSpec.Ignore(false, null, null, null);
        AddActionRequest request6 = ignore(300, null, "x", null);
        assertThrows(IllegalArgumentException.class, () -> check(1, request6));

        policy = new SymptomSpec.Ignore(true, "PT30M", true, List.of("CASE"));
        AddActionRequest request7 = ignore(300, null, "x", null);
        assertThrows(IllegalArgumentException.class, () -> check(1, request7), "note required");
        AddActionRequest request8 = ignore(3600, null, "x", "n");
        assertThrows(IllegalArgumentException.class, () -> check(1, request8), "30 min at most");
        AddActionRequest request9 = ignore(300, Map.of("scope", "ALL"), "x", "n");
        assertThrows(IllegalArgumentException.class, () -> check(1, request9));
        AddActionRequest request10 = ignore(null, Map.of("until_trip_end", true), "x", "n");
        assertThrows(IllegalArgumentException.class,
                () -> check(1, request10), "no trip end with a maximum");
        assertEquals(1800, check(1, ignore(1800, Map.of("scope", "CASE"), "x", "n")).durationSeconds());
    }

    @Test
    void untilTheTripEndsNeedsARunningTrip() {
        engineCase(1, SPEEDING, TRUCK, 2, null);
        engineCase(2, STOP, TRUCK, 2, "trip-1");
        Map<String, Object> tripEnd = Map.of("until_trip_end", true);
        AddActionRequest request11 = ignore(null, tripEnd, "x", null);
        assertThrows(IllegalArgumentException.class, () -> check(1, request11), "no trip");
        AddActionRequest request12 = ignore(null, tripEnd, "x", null);
        assertThrows(IllegalArgumentException.class, () -> check(2, request12), "unknown");
        holds.live.put("trip-1", true);

        IgnoreHolds.Checked checked = check(2, ignore(300, tripEnd, "x", null));
        assertNull(checked.durationSeconds());
        assertEquals(true, checked.details().get("until_trip_end"));
    }

    @Test
    void aClosedOrHeldCaseCannotBeIgnored() {
        EngineCase c = engineCase(1, SPEEDING, TRUCK, 2, null);
        cases.close(TENANT, 1, "ops@example.com", NOW);
        AddActionRequest request13 = ignore(300, null, "x", null);
        assertThrows(IllegalStateException.class, () -> check(1, request13));
        cases.add(new EngineCase(2, SPEEDING, "1.0.0", "Exceso", "speed", TRUCK, NOW, 2, null, null, null, null,
                null, 0, null, null, null).withHold(new EngineCase.Ignored("h", NOW, NOW.plusSeconds(60), false,
                        "CASE", "ops@example.com"), null));
        AddActionRequest request14 = ignore(300, null, "x", null);
        assertThrows(IllegalStateException.class, () -> check(2, request14));
        assertEquals(1, c.id());
    }

    private IgnoreHold hold(long caseId, IgnoreHold.Scope scope, Instant at, Integer seconds, boolean tripEnd,
            String trip, boolean caseClosed) {
        String id = treatment(caseId).id();
        IgnoreHold h = new IgnoreHold(id, TENANT, caseId, TRUCK, SPEEDING, trip, scope, at, "ops@example.com",
                seconds, tripEnd, caseClosed);
        holds.open.put(id, h);
        return h;
    }

    private String resolution(IgnoreHold h) {
        return treatments.find(TENANT, h.id()).orElseThrow().resolution();
    }

    @Test
    void anExpiredHoldReturnsAnOpenCaseOrRecordsItResolved() {
        engineCase(1, SPEEDING, TRUCK, 3, null);
        engineCase(2, SPEEDING, "DEMO02", 3, null);
        engineCase(3, STOP, TRUCK, 3, null);
        cases.close(TENANT, 2, "rule", NOW);
        IgnoreHold expired = hold(1, IgnoreHold.Scope.CASE, NOW.minusSeconds(400), 300, false, null, false);
        IgnoreHold resolved = hold(2, IgnoreHold.Scope.SYMPTOM, NOW.minusSeconds(400), 300, false, null, true);
        IgnoreHold running = hold(3, IgnoreHold.Scope.ALL, NOW.minusSeconds(100), 300, false, null, false);

        assertEquals(2, service.endDue(100));

        assertEquals(HoldService.RETURNED, resolution(expired));
        assertEquals(HoldService.RESOLVED, resolution(resolved));
        assertEquals(TreatmentStatus.OPEN, treatments.find(TENANT, running.id()).orElseThrow().status());
        assertEquals(HoldService.SYSTEM, treatments.find(TENANT, expired.id()).orElseThrow().closedBy());
        assertTrue(audit.list(TENANT, null, null, null, null, null, 100).stream()
                .anyMatch(e -> e.action().equals("treatment.hold_ended")));
    }

    @Test
    void aCaseScopeHoldEndsWhenItsCaseCloses() {
        engineCase(1, SPEEDING, TRUCK, 3, null);
        cases.close(TENANT, 1, "rule", NOW);
        IgnoreHold h = hold(1, IgnoreHold.Scope.CASE, NOW.minusSeconds(10), 3600, false, null, true);

        assertEquals(1, service.endDue(100));
        assertEquals(HoldService.RESOLVED, resolution(h));
    }

    @Test
    void theEndOfTheTripClosesTheHeldCasesAsIgnored() {
        engineCase(1, SPEEDING, TRUCK, 3, "trip-1");
        engineCase(2, STOP, TRUCK, 1, "trip-1");
        engineCase(3, STOP, "DEMO02", 1, null);
        holds.live.put("trip-1", true);
        IgnoreHold h = hold(1, IgnoreHold.Scope.ALL, NOW.minusSeconds(10), null, true, "trip-1", false);
        assertEquals(0, service.endDue(100), "the trip runs");

        holds.live.put("trip-1", false);
        assertEquals(1, service.endDue(100));

        assertEquals(HoldService.IGNORED, resolution(h));
        assertNotNull(cases.find(TENANT, 1).orElseThrow().closedAt());
        assertNotNull(cases.find(TENANT, 2).orElseThrow().closedAt(), "scope ALL: the vehicle's other case");
        assertNull(cases.find(TENANT, 3).orElseThrow().closedAt(), "another vehicle");
    }

    @Test
    void resumeLiftsTheHoldOnce() {
        engineCase(1, SPEEDING, TRUCK, 3, null);
        IgnoreHold h = hold(1, IgnoreHold.Scope.CASE, NOW.minusSeconds(10), 3600, false, null, false);

        Treatment ended = service.resume(TENANT, "lead@example.com", h.id());

        assertEquals(HoldService.RETURNED, ended.resolution());
        assertEquals("lead@example.com", ended.closedBy());
        holds.open.remove(h.id());
        assertThrows(IllegalStateException.class, () -> service.resume(TENANT, "lead@example.com", h.id()));
        String missingId = UUID.randomUUID().toString();
        assertThrows(java.util.NoSuchElementException.class,
                () -> service.resume(TENANT, "lead@example.com", missingId));
    }
}
