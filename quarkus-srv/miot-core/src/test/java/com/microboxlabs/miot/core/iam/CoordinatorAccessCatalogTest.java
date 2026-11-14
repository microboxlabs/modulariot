package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CoordinatorAccessCatalogTest {

    private final AccessRegistry registry =
            new AccessRegistry(List.of(new CoreAccessCatalog(), new CoordinatorAccessCatalog()));

    @Test
    void stageAndAdminPermissionsComeOnlyFromARole() {
        Set<String> owner = registry.permissionsOf(BaseRole.OWNER);
        assertFalse(owner.contains(CoordinatorAccessCatalog.STAGE_CONTROL_TOWER));
        assertFalse(owner.contains(CoordinatorAccessCatalog.ADMIN_CONSOLE));
        assertTrue(owner.contains(CoordinatorAccessCatalog.KANBAN_VIEW));
        assertTrue(registry.permissionsOf(BaseRole.MEMBER, List.of(CoordinatorAccessCatalog.SYSTEM_ADMIN))
                .contains(CoordinatorAccessCatalog.ADMIN_CONSOLE));
    }

    @Test
    void aReviewerSeesTheBoardButCannotCompleteTasks() {
        Set<String> reviewer = registry.permissionsOf(BaseRole.MEMBER, List.of(CoordinatorAccessCatalog.REVIEWER));
        assertTrue(reviewer.contains(CoordinatorAccessCatalog.KANBAN_VIEW));
        assertFalse(reviewer.contains(CoordinatorAccessCatalog.TASK_COMPLETE));
    }

    @Test
    void aReviewerSeesTheBoardTheFinishedServicesAndTheGeographicView() {
        RoleDef reviewer = registry.role(CoordinatorAccessCatalog.REVIEWER).orElseThrow();
        assertEquals(Set.of(CoordinatorAccessCatalog.KANBAN_VIEW, CoordinatorAccessCatalog.FINISHED_VIEW,
                CoordinatorAccessCatalog.GEOGRAPHIC_VIEW), reviewer.permissions());
        assertTrue(reviewer.description().get("es").contains("vista geográfica"));
        assertTrue(reviewer.description().get("en").contains("geographic view"));
    }

    @Test
    void eachStageRoleWorksItsOwnStage() {
        Set<String> executive =
                registry.permissionsOf(BaseRole.MEMBER, List.of(CoordinatorAccessCatalog.CONTROL_TOWER_EXECUTIVE));
        assertTrue(executive.contains(CoordinatorAccessCatalog.STAGE_CONTROL_TOWER));
        assertFalse(executive.contains(CoordinatorAccessCatalog.TASK_COMPLETE));
        Set<String> validator =
                registry.permissionsOf(BaseRole.MEMBER, List.of(CoordinatorAccessCatalog.TRANSPORT_VALIDATOR));
        assertTrue(validator.contains(CoordinatorAccessCatalog.STAGE_TRANSPORT_VALIDATION));
        assertFalse(validator.contains(CoordinatorAccessCatalog.STAGE_CONTROL_TOWER));
    }

    @Test
    void onlyTheBoardRoleCompletesTasks() {
        for (RoleDef role : new CoordinatorAccessCatalog().roles()) {
            boolean completes = role.permissions().contains(CoordinatorAccessCatalog.TASK_COMPLETE);
            assertEquals(CoordinatorAccessCatalog.KANBAN_USER.equals(role.key()), completes, role.key());
        }
    }

    @Test
    void anyRoleSeesTheGeographicView() {
        for (RoleDef role : registry.roles()) {
            assertTrue(registry.permissionsOf(BaseRole.MEMBER, List.of(role.key()))
                    .contains(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW), role.key());
        }
        assertTrue(registry.permissionsOf(BaseRole.MEMBER, List.of(CoordinatorAccessCatalog.CALENDAR_VIEWER))
                .contains(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW));
    }

    @Test
    void aMemberWithoutRolesOrWithUnknownRolesDoesNotSeeTheGeographicView() {
        assertFalse(registry.permissionsOf(BaseRole.MEMBER, List.of())
                .contains(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW));
        assertFalse(registry.permissionsOf(BaseRole.MEMBER, List.of("GONE_ROLE"))
                .contains(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW));
    }

    @Test
    void aCustomRoleOfTheOrganizationAlsoGivesTheGeographicView() {
        OrgRoles org = new OrgRoles(registry, Map.of("custom:board", Set.of(CoordinatorAccessCatalog.KANBAN_VIEW)));
        assertTrue(org.permissionsOf(BaseRole.MEMBER, List.of("custom:board"))
                .contains(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW));
        assertFalse(org.permissionsOf(BaseRole.MEMBER, List.of("custom:deleted"))
                .contains(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW));
    }

    @Test
    void noModuleOfTheCatalogHasALegacyDefault() {
        assertTrue(registry.legacyDefaults().isEmpty());
    }
}
