package com.microboxlabs.miot.symptoms.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseService;
import com.microboxlabs.miot.symptoms.cases.HoldIndex;
import com.microboxlabs.miot.symptoms.cases.HoldService;
import com.microboxlabs.miot.symptoms.cases.HoldStore;
import com.microboxlabs.miot.symptoms.cases.IgnoreHold;
import com.microboxlabs.miot.symptoms.cases.InMemoryEngineCases;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.evaluator.OperatorClose;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.dto.CloseTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.OpenTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.DemoSeeder;
import com.microboxlabs.miot.symptoms.service.TreatmentService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.core.Response;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** "Ignorar condición" through the treatments API: the IGNORE action, the hold's checks, and Reanudar. */
class OrgControlTowerTreatmentsResourceTest {

    private static final String ORG = "org-a";
    private static final String TENANT = "client-a";
    private static final Duration WAIT = Duration.ofSeconds(5);
    private static final Instant NOW = Instant.parse("2026-11-03T12:00:00Z");
    private static final UUID SPEEDING = UUID.randomUUID();

    private final InMemoryEngineCases cases = new InMemoryEngineCases();
    private final InMemoryTreatmentStore treatments = new InMemoryTreatmentStore();
    private final InMemoryContactStore contacts = new InMemoryContactStore();
    private final Map<String, IgnoreHold> open = new HashMap<>();
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private final HoldStore holdStore = new HoldStore() {
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
            return Optional.empty();
        }
    };

    private static final class Roles extends OrganizationRoleService {
        Roles() {
            super(null, null, null);
        }

        @Override
        public Uni<Access> access(String organizationSlug, Caller caller) {
            return Uni.createFrom().item(new Access(1L, organizationSlug, BaseRole.MEMBER, Set.of(),
                    Set.of(ControlTowerAccessCatalog.CASE_TREAT)));
        }
    }

    private final AuditService audit = new AuditService(new InMemoryAuditStore());
    /** How the operator closed each engine case, as the evaluator receives it. */
    private final List<OperatorClose> operatorCloses = new ArrayList<>();
    private final EngineCaseService caseService = new EngineCaseService(cases, new EngineCaseService.Forget() {
        @Override
        public void episode(String tenantCode, String assetId, UUID definitionId) {
            // Nothing is kept.
        }

        @Override
        public void closed(String tenantCode, String assetId, UUID definitionId, OperatorClose close) {
            operatorCloses.add(close);
        }
    }, t -> null, clock);
    private final HoldService holds = new HoldService(cases, caseService, holdStore, new HoldIndex(holdStore),
            treatments, audit, (tenant, c) -> null, clock);
    private final OrgControlTowerTreatmentsResource resource = resource();

    private OrgControlTowerTreatmentsResource resource() {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail("ops@example.com");
        TenantContext tenant = new TenantContext();
        tenant.setClientId(TENANT);
        return new OrgControlTowerTreatmentsResource(tenant, org, new Roles(), null,
                new TreatmentService(treatments, contacts, new DemoSeeder(false, contacts, treatments), audit, holds),
                caseService, holds);
    }

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }

    private TreatmentView openTreatment(long caseId) {
        cases.add(new EngineCase(caseId, SPEEDING, "1.0.0", "Exceso", "speed", "DEMO01", NOW.minusSeconds(600), 3,
                null, null, null, null, null, 0, null, null, null));
        return (TreatmentView) call(resource.open(ORG, String.valueOf(-caseId),
                new OpenTreatmentRequest(TreatmentType.IGNORE_CONDITION, "DEMO01", null, null))).getEntity();
    }

    private static AddActionRequest ignore(Integer seconds, Map<String, Object> details) {
        return new AddActionRequest(ActionKind.IGNORE, null, null, null, null, null, "ignore_reason_2",
                "Zona de sombra GPS conocida", null, seconds, null, null, null, details);
    }

    @Test
    void anIgnoreStoresTheHoldAndTheCaseState() {
        TreatmentView t = openTreatment(10);

        Response r = call(resource.addAction(ORG, t.id(), ignore(1800, Map.of("scope", "symptom"))));

        assertEquals(201, r.getStatus());
        TreatmentAction a = (TreatmentAction) r.getEntity();
        assertEquals(1800, a.durationSeconds());
        assertEquals("SYMPTOM", a.details().get("scope"));
        assertEquals(3, a.details().get("case_level"));
    }

    @Test
    void anIgnoreThatBreaksTheRulesIsA400() {
        TreatmentView t = openTreatment(11);
        assertEquals(400, call(resource.addAction(ORG, t.id(), ignore(null, null))).getStatus());
        assertEquals(400, call(resource.addAction(ORG, t.id(), ignore(300, Map.of("until_trip_end", true))))
                .getStatus(), "no trip to wait for");
    }

    @Test
    void aCallOnAChannelTheContactLacksIsA400() {
        Contact luis = contacts.insert(new Contact(null, TENANT, "Luis", "Transportista", "+12025550102",
                List.of(CallMethod.PHONE), true, null, "ops@example.com", null, null));
        TreatmentView t = openTreatment(13);

        Response r = call(resource.addAction(ORG, t.id(), new AddActionRequest(ActionKind.CALL, luis.id(), null, null,
                null, CallMethod.TEAMS, null, "No contesta", false, 0, null, null, null, null)));

        assertEquals(400, r.getStatus());
        assertTrue(String.valueOf(r.getEntity()).contains("has no TEAMS channel"), String.valueOf(r.getEntity()));
    }

    @Test
    void resumeLiftsAnOpenHoldAndIsA409Otherwise() {
        TreatmentView t = openTreatment(12);
        call(resource.addAction(ORG, t.id(), ignore(1800, null)));
        assertEquals(409, call(resource.cancel(ORG, t.id(), Map.of("reason", "x"))).getStatus(),
                "a hold is resumed, not cancelled");
        open.put(t.id(), new IgnoreHold(t.id(), TENANT, 12, "DEMO01", SPEEDING, null, IgnoreHold.Scope.CASE,
                NOW.minusSeconds(60), "ops@example.com", 1800, false, false));

        Response r = call(resource.resume(ORG, t.id()));

        assertEquals(200, r.getStatus());
        assertEquals(HoldService.RETURNED, ((TreatmentView) r.getEntity()).resolution());
        open.clear();
        assertEquals(409, call(resource.resume(ORG, t.id())).getStatus());
        assertEquals(404, call(resource.resume(ORG, UUID.randomUUID().toString())).getStatus());
    }

    private void addCase(long caseId, String tripId, Instant closedAt) {
        cases.add(new EngineCase(caseId, SPEEDING, "1.0.0", "Exceso", "speed", "DEMO01", NOW.minusSeconds(600), 3,
                tripId, null, null, null, closedAt, 0, null, null, null));
    }

    private TreatmentView open(long caseId, TreatmentType type) {
        return (TreatmentView) call(resource.open(ORG, String.valueOf(-caseId),
                new OpenTreatmentRequest(type, "DEMO01", "T-1", null))).getEntity();
    }

    @Test
    void anInvalidationTellsTheEngineAndACallDoesNot() {
        addCase(30, "T-1", null);
        TreatmentView invalidate = open(30, TreatmentType.INVALIDATE_SYMPTOM);
        call(resource.addAction(ORG, invalidate.id(), new AddActionRequest(ActionKind.INVALIDATE, null, null, null,
                null, null, "rule_miscalibrated", "Regla mal calibrada", null, null, null, null, null, null)));
        assertEquals(200, call(resource.close(ORG, invalidate.id(), new CloseTreatmentRequest(null, null)))
                .getStatus());

        addCase(31, "T-1", null);
        TreatmentView handled = open(31, TreatmentType.CALL);
        call(resource.addAction(ORG, handled.id(), new AddActionRequest(ActionKind.CALL, null, "Conductor", null,
                "+12025550100", CallMethod.PHONE, null, "Compromete corrección", true, 60, null, null, null, null)));
        assertEquals(200, call(resource.close(ORG, handled.id(), new CloseTreatmentRequest(null, null)))
                .getStatus());

        assertEquals(List.of(new OperatorClose("T-1", NOW, 3, true), new OperatorClose("T-1", NOW, 3, false)),
                operatorCloses);
    }
}
