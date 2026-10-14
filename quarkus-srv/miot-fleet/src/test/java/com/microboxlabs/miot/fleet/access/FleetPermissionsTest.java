package com.microboxlabs.miot.fleet.access;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.iam.AccessRegistry;
import com.microboxlabs.miot.core.iam.AccessRules;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.fleet.api.OrgFleetNetworkResource;
import io.quarkus.security.PermissionsAllowed;
import jakarta.ws.rs.GET;
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
            "OrgFleetNetworkResource.assets", FleetAccessCatalog.NETWORK_VIEW,
            "OrgFleetNetworkResource.asset", FleetAccessCatalog.NETWORK_VIEW,
            "OrgFleetNetworkResource.relationships", FleetAccessCatalog.NETWORK_VIEW));

    @Test
    void everyEndpointDeclaresItsOrganizationPermission() {
        Map<String, String> actual = new TreeMap<>();
        for (Method method : OrgFleetNetworkResource.class.getDeclaredMethods()) {
            if (!Modifier.isPublic(method.getModifiers()) || !method.isAnnotationPresent(GET.class)) {
                continue;
            }
            String name = "OrgFleetNetworkResource." + method.getName();
            PermissionsAllowed allowed = method.getAnnotation(PermissionsAllowed.class);
            assertNotNull(allowed, name + " has no @PermissionsAllowed");
            assertEquals(OrgPermission.class, allowed.permission(), name);
            assertArrayEquals(new String[] {"organizationId"}, allowed.params(), name);
            actual.put(name, allowed.value()[0]);
        }
        assertEquals(EXPECTED, actual);
    }

    @Test
    void theViewerRoleCanViewTheNetwork() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog(), new FleetAccessCatalog()));
        Set<String> viewer = AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(true, BaseRole.MEMBER, false, false, false, Set.of(FleetAccessCatalog.VIEWER),
                        null), registry).permissions();
        assertTrue(viewer.contains(FleetAccessCatalog.NETWORK_VIEW));
    }
}
