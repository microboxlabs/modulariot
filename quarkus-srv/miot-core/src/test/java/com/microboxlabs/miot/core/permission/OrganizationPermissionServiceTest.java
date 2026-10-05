package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.model.Organization;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.ForbiddenException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class OrganizationPermissionServiceTest {

    private static final String OWNER = "owner@example.com";
    private static final String TRAINER = "trainer@example.com";
    private static final String MEMBER = "member@example.com";

    @Test
    void ownersAreTrainersWithoutAnAssignment() {
        var service = service(null);
        assertTrue(allowed(service, OrganizationPermissionDefinition.HARNESS_TRAINER, OWNER));
        assertTrue(service.assignmentChecks.isEmpty());
    }

    @Test
    void assignedMembersAreTrainers() {
        var service = service(null);
        assertTrue(allowed(service, OrganizationPermissionDefinition.HARNESS_TRAINER, TRAINER));
    }

    @Test
    void unassignedMembersAreNotTrainers() {
        var service = service(null);
        assertFalse(allowed(service, OrganizationPermissionDefinition.HARNESS_TRAINER, MEMBER));
        assertEquals(List.of(MEMBER), service.assignmentChecks);
    }

    @Test
    void ownersDoNotImplicitlyHoldPermissionsThatAreNotGrantedToOwners() {
        var service = service(null);
        assertFalse(allowed(service,
                OrganizationPermissionDefinition.CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE, OWNER));
        assertEquals(List.of(OWNER), service.assignmentChecks);
    }

    @Test
    void requirePermissionRejectsCallersWithoutAnIdentity() {
        var service = service(null);
        Uni<Void> gate = service.requirePermission(
                "org", OrganizationPermissionDefinition.HARNESS_TRAINER);
        assertThrows(ForbiddenException.class, gate.await()::indefinitely);
    }

    @Test
    void currentUserWithoutAnIdentityIsNotAllowed() {
        var service = service(" ");
        var decision = service.checkCurrentUser("org", "harness_trainer")
                .await().indefinitely();
        assertEquals("HARNESS_TRAINER", decision.permissionCode());
        assertFalse(decision.allowed());
    }

    private static boolean allowed(
            FakePermissionService service,
            OrganizationPermissionDefinition permission,
            String personId) {
        return service.hasPermission(new Organization(), permission, personId)
                .await().indefinitely();
    }

    private static FakePermissionService service(String callerEmail) {
        var context = new OrganizationContext();
        context.setUserEmail(callerEmail);
        return new FakePermissionService(
                new FakeRoleService(Map.of(OWNER, OrganizationRoleService.OWNER_ACCESS_ROLE)),
                context,
                Set.of(TRAINER));
    }

    private static final class FakeRoleService extends OrganizationRoleService {
        private final Map<String, String> roles;

        FakeRoleService(Map<String, String> roles) {
            super(null, null, null);
            this.roles = roles;
        }

        @Override
        public Uni<String> resolveApplicationRole(Organization organization, String personId) {
            return Uni.createFrom().item(
                    roles.getOrDefault(personId, OrganizationRoleService.MEMBER_ACCESS_ROLE));
        }
    }

    private static final class FakePermissionService extends OrganizationPermissionService {
        private final Set<String> assigned;
        final List<String> assignmentChecks = new ArrayList<>();

        FakePermissionService(
                OrganizationRoleService roles, OrganizationContext context, Set<String> assigned) {
            super(roles, context, null);
            this.assigned = assigned;
        }

        @Override
        Uni<Boolean> isAllowed(
                Long organizationId,
                OrganizationPermissionDefinition permission,
                String subjectId) {
            assignmentChecks.add(subjectId);
            return Uni.createFrom().item(assigned.contains(subjectId));
        }
    }
}
