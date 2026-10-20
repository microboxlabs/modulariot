package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import jakarta.json.Json;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TokenRolesTest {

    private static final Map<String, String> MAP = Map.of(
            "10102", "ADMIN",
            "10401", CoordinatorAccessCatalog.KANBAN_USER,
            "10502", CoordinatorAccessCatalog.TRANSPORT_VALIDATOR);

    @Test
    void idsComeAsStringsOrNumbers() {
        assertEquals(Set.of("10401", "10502"),
                TokenRoles.ids(Json.createArrayBuilder().add("10401").add(10502).build()));
        assertEquals(Set.of("10401"), TokenRoles.ids(List.of(" 10401 ", "")));
        assertEquals(Set.of("10401"), TokenRoles.ids("10401"));
    }

    @Test
    void aModuleRoleMakesAMemberAndIsAdded() {
        TokenRoles.Plan plan = TokenRoles.plan(Set.of("10502"), MAP, Set.of(), Set.of());
        assertEquals("MEMBER", plan.baseRole());
        assertEquals(Set.of(CoordinatorAccessCatalog.TRANSPORT_VALIDATOR), plan.add());
        assertEquals(Set.of(), plan.remove());
    }

    @Test
    void theHighestBaseRoleWins() {
        assertEquals("ADMIN", TokenRoles.plan(Set.of("10102", "10401"), MAP, Set.of(), Set.of()).baseRole());
    }

    @Test
    void aCoveredRoleMissingFromTheTokenIsRemovedAndAnUncoveredOneIsKept() {
        TokenRoles.Plan plan = TokenRoles.plan(Set.of("10502"), MAP,
                Set.of(CoordinatorAccessCatalog.KANBAN_USER, CoordinatorAccessCatalog.TRANSPORT_VALIDATOR,
                        "HARNESS_TRAINER"), Set.of());
        assertEquals(Set.of(), plan.add());
        assertEquals(Set.of(CoordinatorAccessCatalog.KANBAN_USER), plan.remove());
    }

    @Test
    void noMappedIdMeansNoMembership() {
        TokenRoles.Plan plan = TokenRoles.plan(Set.of("99999"), MAP, Set.of(CoordinatorAccessCatalog.KANBAN_USER),
                Set.of());
        assertNull(plan.baseRole());
        assertEquals(Set.of(CoordinatorAccessCatalog.KANBAN_USER), plan.remove());
    }

    @Test
    void aTokenRoleWhoseMappingWasDeletedIsRemoved() {
        TokenRoles.Plan plan = TokenRoles.plan(Set.of("10502"), Map.of("10502", CoordinatorAccessCatalog.TRANSPORT_VALIDATOR),
                Set.of(CoordinatorAccessCatalog.KANBAN_USER, "HARNESS_TRAINER"), Set.of(CoordinatorAccessCatalog.KANBAN_USER));
        assertEquals(Set.of(CoordinatorAccessCatalog.KANBAN_USER), plan.remove());
        assertEquals(Set.of(CoordinatorAccessCatalog.TRANSPORT_VALIDATOR), plan.wanted());
    }

    @Test
    void theTokenRaisesAMembersBaseRoleOnlyForTheRequest() {
        assertEquals(BaseRole.ADMIN, AccessEvaluator.withToken(BaseRole.MEMBER, "ADMIN"));
        assertEquals(BaseRole.OWNER, AccessEvaluator.withToken(BaseRole.OWNER, "MEMBER"));
        assertNull(AccessEvaluator.withToken(null, "ADMIN"));
    }
}
