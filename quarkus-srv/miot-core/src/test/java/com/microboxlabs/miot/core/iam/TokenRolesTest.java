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
        TokenRoles.Plan plan = TokenRoles.plan(Set.of("10502"), MAP, Set.of());
        assertEquals("MEMBER", plan.baseRole());
        assertEquals(Set.of(CoordinatorAccessCatalog.TRANSPORT_VALIDATOR), plan.add());
        assertEquals(Set.of(), plan.remove());
    }

    @Test
    void theHighestBaseRoleWins() {
        assertEquals("ADMIN", TokenRoles.plan(Set.of("10102", "10401"), MAP, Set.of()).baseRole());
    }

    @Test
    void aCoveredRoleMissingFromTheTokenIsRemovedAndAnUncoveredOneIsKept() {
        TokenRoles.Plan plan = TokenRoles.plan(Set.of("10502"), MAP,
                Set.of(CoordinatorAccessCatalog.KANBAN_USER, CoordinatorAccessCatalog.TRANSPORT_VALIDATOR,
                        "HARNESS_TRAINER"));
        assertEquals(Set.of(), plan.add());
        assertEquals(Set.of(CoordinatorAccessCatalog.KANBAN_USER), plan.remove());
    }

    @Test
    void noMappedIdMeansNoMembership() {
        TokenRoles.Plan plan = TokenRoles.plan(Set.of("99999"), MAP, Set.of(CoordinatorAccessCatalog.KANBAN_USER));
        assertNull(plan.baseRole());
        assertEquals(Set.of(CoordinatorAccessCatalog.KANBAN_USER), plan.remove());
    }
}
