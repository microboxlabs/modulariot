package com.microboxlabs.miot.places.access;

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
import com.microboxlabs.miot.places.api.OrgGeofencesResource;
import io.quarkus.security.PermissionsAllowed;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

class PlacesPermissionsTest {

    private static final List<Class<?>> RESOURCES = List.of(OrgGeofencesResource.class);

    private static final String VIEW = PlacesAccessCatalog.VIEW;
    private static final String GEOFENCE_WRITE = PlacesAccessCatalog.GEOFENCE_WRITE;

    /** Every endpoint and the permission it needs. A new endpoint without an entry here fails the test. */
    private static final Map<String, String> EXPECTED = new TreeMap<>(Map.ofEntries(
            Map.entry("OrgGeofencesResource.list", VIEW + " | " + PlacesAccessCatalog.CONTROL_TOWER_VIEW)));

    @Test
    void everyEndpointDeclaresItsOrganizationPermission() {
        Map<String, String> actual = new TreeMap<>();
        for (Class<?> resource : RESOURCES) {
            for (Method method : resource.getDeclaredMethods()) {
                if (!Modifier.isPublic(method.getModifiers()) || !isEndpoint(method)) {
                    continue;
                }
                PermissionsAllowed allowed = method.getAnnotation(PermissionsAllowed.class);
                String name = resource.getSimpleName() + "." + method.getName();
                assertNotNull(allowed, name + " has no @PermissionsAllowed");
                assertEquals(OrgPermission.class, allowed.permission(), name);
                assertArrayEquals(new String[] {"organizationId"}, allowed.params(), name);
                assertFalse(allowed.inclusive(), name + " must accept either read permission");
                actual.put(name, String.join(" | ", allowed.value()));
            }
        }
        assertEquals(EXPECTED, actual);
    }

    @Test
    void eachRoleCanDoWhatItsNameSays() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog(), new PlacesAccessCatalog()));
        Set<String> viewer = grant(registry, PlacesAccessCatalog.VIEWER);
        Set<String> maintainer = grant(registry, PlacesAccessCatalog.MAINTAINER);

        assertTrue(viewer.contains(VIEW) && !viewer.contains(GEOFENCE_WRITE));
        assertTrue(maintainer.containsAll(Set.of(VIEW, GEOFENCE_WRITE)));
    }

    @Test
    void theOrganizationsOwnClientViewsWithoutARole() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog(), new PlacesAccessCatalog()));
        Set<String> client = AccessRules.resolve(1L, "acme", Caller.client("acme-client"),
                new AccessRules.Facts(null, true, Set.of()), registry).permissions();
        assertTrue(client.contains(VIEW) && !client.contains(GEOFENCE_WRITE));
    }

    private static Set<String> grant(AccessRegistry registry, String role) {
        return AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(BaseRole.MEMBER, false, Set.of(role)), registry)
                .permissions();
    }

    private static boolean isEndpoint(Method method) {
        return method.isAnnotationPresent(GET.class) || method.isAnnotationPresent(POST.class)
                || method.isAnnotationPresent(PUT.class) || method.isAnnotationPresent(PATCH.class)
                || method.isAnnotationPresent(DELETE.class);
    }
}
