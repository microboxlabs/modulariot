package com.microboxlabs.miot.fleet.access;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.iam.AccessRegistry;
import com.microboxlabs.miot.core.iam.AccessRules;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.fleet.api.OrgFleetResource;
import io.quarkus.security.PermissionsAllowed;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

class FleetPermissionsTest {

    /** Every endpoint and the permission it needs. A new endpoint without an entry here fails the test. */
    private static final Map<String, String> EXPECTED = new TreeMap<>(Map.of(
            "OrgFleetResource.assets", FleetAccessCatalog.ASSETS_VIEW,
            "OrgFleetResource.asset", FleetAccessCatalog.ASSETS_VIEW,
            "OrgFleetResource.activity", FleetAccessCatalog.ASSETS_VIEW,
            "OrgFleetResource.update", FleetAccessCatalog.ASSETS_EDIT,
            "OrgFleetResource.accept", FleetAccessCatalog.ASSETS_EDIT,
            "OrgFleetResource.dismiss", FleetAccessCatalog.ASSETS_EDIT));

    @Test
    void everyEndpointDeclaresItsOrganizationPermission() {
        Map<String, String> actual = new TreeMap<>();
        for (Method method : OrgFleetResource.class.getDeclaredMethods()) {
            boolean endpoint = method.isAnnotationPresent(GET.class) || method.isAnnotationPresent(POST.class)
                    || method.isAnnotationPresent(PATCH.class);
            if (!Modifier.isPublic(method.getModifiers()) || !endpoint) {
                continue;
            }
            String name = "OrgFleetResource." + method.getName();
            PermissionsAllowed allowed = method.getAnnotation(PermissionsAllowed.class);
            assertNotNull(allowed, name + " has no @PermissionsAllowed");
            assertEquals(OrgPermission.class, allowed.permission(), name);
            assertArrayEquals(new String[] {"organizationId"}, allowed.params(), name);
            actual.put(name, allowed.value()[0]);
        }
        assertEquals(EXPECTED, actual);
    }

    @Test
    void theViewerRoleViewsAndTheManagerRoleAlsoEdits() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog(), new FleetAccessCatalog()));
        Set<String> viewer = permissions(registry, FleetAccessCatalog.VIEWER);
        assertTrue(viewer.contains(FleetAccessCatalog.ASSETS_VIEW));
        assertFalse(viewer.contains(FleetAccessCatalog.ASSETS_EDIT));
        Set<String> manager = permissions(registry, FleetAccessCatalog.MANAGER);
        assertTrue(manager.containsAll(Set.of(FleetAccessCatalog.ASSETS_VIEW, FleetAccessCatalog.ASSETS_EDIT)));
    }

    private static Set<String> permissions(AccessRegistry registry, String role) {
        return AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(true, BaseRole.MEMBER, false, false, false, Set.of(role), null), registry)
                .permissions();
    }
}
