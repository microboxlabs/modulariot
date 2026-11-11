package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.api.dto.SetOrganizationRoleRequest;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.model.Organization;
import io.smallrye.mutiny.Uni;
import java.time.Duration;
import jakarta.ws.rs.BadRequestException;
import java.util.Set;
import org.junit.jupiter.api.Test;

class OrganizationRoleServiceTest {

    @Test
    void onlyTheOwnerRoleMustKeepAnAssignee() {
        SetOrganizationRoleRequest none = new SetOrganizationRoleRequest(Set.of(" "));
        assertThrows(BadRequestException.class,
                () -> OrganizationRoleService.normalizeAssignees(none, OrganizationRoleService.OWNER_ROLE_CODE));
        assertTrue(OrganizationRoleService.normalizeAssignees(none, "CONTROL_TOWER_VIEWER").isEmpty());
        assertEquals(Set.of("ana@example.com"), OrganizationRoleService.normalizeAssignees(
                new SetOrganizationRoleRequest(Set.of(" ana@example.com ")), "CONTROL_TOWER_VIEWER"));
    }

    @Test
    void ownersAndAdminsHaveOwnerAccessForTheApp() {
        assertEquals("OWNER", OrganizationRoleService.accessRole(access(BaseRole.OWNER)));
        assertEquals("OWNER", OrganizationRoleService.accessRole(access(BaseRole.ADMIN)));
        assertEquals("MEMBER", OrganizationRoleService.accessRole(access(BaseRole.MEMBER)));
        assertEquals("MEMBER", OrganizationRoleService.accessRole(Access.none(1L, "acme")));
    }

    @Test
    void aSubAccountAdminKeepsAuthorityForSubAccountConfiguration() {
        Organization root = new Organization();
        root.id = 1L;
        root.slug = "root";
        Organization child = new Organization();
        child.id = 2L;
        child.slug = "child";
        child.parent = root;
        AccessEvaluator evaluator = new AccessEvaluator(null, null, null, null) {
            @Override
            public Uni<Organization> root(Organization ignored) {
                return Uni.createFrom().item(root);
            }

            @Override
            public Uni<Access> evaluate(Organization organization, Caller caller) {
                return Uni.createFrom().item(organization == child
                        ? new Access(2L, "child", BaseRole.ADMIN, Set.of(), Set.of())
                        : Access.none(1L, "root"));
            }
        };
        OrganizationContext context = new OrganizationContext();
        context.setUserEmail("child.admin@example.test");
        OrganizationRoleService service = new OrganizationRoleService(context, evaluator, null);
        assertDoesNotThrow(() -> service.requireOwner(child).await().atMost(Duration.ofSeconds(1)));
    }

    private static Access access(BaseRole base) {
        return new Access(1L, "acme", base, Set.of(), Set.of());
    }
}
