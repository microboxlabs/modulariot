package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.api.dto.SetPlatformRoleRequest;
import jakarta.ws.rs.BadRequestException;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PlatformRoleServiceTest {

    @Test
    void lowerCasesAndTrimsAssigneesSoAGrantMatchesTheAuthorizer() {
        Set<String> normalized = PlatformRoleService.normalizeAssignees(
                new SetPlatformRoleRequest(Set.of(" Owner@Example.Test ", "second@example.test")));

        assertEquals(Set.of("owner@example.test", "second@example.test"), normalized);
    }

    @Test
    void dropsBlankAndNullAssignees() {
        Set<String> requested = new HashSet<>();
        requested.add("owner@example.test");
        requested.add("   ");
        requested.add(null);

        assertEquals(Set.of("owner@example.test"),
                PlatformRoleService.normalizeAssignees(new SetPlatformRoleRequest(requested)));
    }

    @Test
    void rejectsAMissingAssigneeList() {
        SetPlatformRoleRequest withoutIds = new SetPlatformRoleRequest(null);

        assertThrows(BadRequestException.class,
                () -> PlatformRoleService.normalizeAssignees(null));
        assertThrows(BadRequestException.class,
                () -> PlatformRoleService.normalizeAssignees(withoutIds));
    }

    @Test
    void allowsEmptyingTheTableOnlyWhileConfigurationStillGrantsSomeone() {
        assertDoesNotThrow(() -> PlatformRoleService.requireAWayBackIn(
                Set.of(), Set.of("bootstrap@example.test")));
        assertDoesNotThrow(() -> PlatformRoleService.requireAWayBackIn(
                Set.of("owner@example.test"), Set.of()));

        assertThrows(BadRequestException.class,
                () -> PlatformRoleService.requireAWayBackIn(Set.of(), Set.of()));
    }
}
