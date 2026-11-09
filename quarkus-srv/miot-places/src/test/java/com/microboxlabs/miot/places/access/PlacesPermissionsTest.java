package com.microboxlabs.miot.places.access;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.AccessRegistry;
import com.microboxlabs.miot.core.iam.AccessRules;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import com.microboxlabs.miot.places.api.OrgGeofencesResource;
import com.microboxlabs.miot.places.api.OrgPlacesResource;
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

/** Access to Lugares is decided by its own two permissions: every member views, Lugares › Mantenedor edits. */
class PlacesPermissionsTest {

    private static final List<Class<?>> RESOURCES = List.of(OrgGeofencesResource.class, OrgPlacesResource.class);

    private static final String VIEW = PlacesAccessCatalog.VIEW;
    private static final String WRITE = PlacesAccessCatalog.WRITE;

    /** Every endpoint and the permission it needs. A new endpoint without an entry here fails the test. */
    private static final Map<String, String> EXPECTED = new TreeMap<>(Map.ofEntries(
            Map.entry("OrgGeofencesResource.list", VIEW),
            Map.entry("OrgPlacesResource.list", VIEW),
            Map.entry("OrgPlacesResource.codeUsage", VIEW),
            Map.entry("OrgPlacesResource.get", VIEW),
            Map.entry("OrgPlacesResource.versions", VIEW),
            Map.entry("OrgPlacesResource.create", WRITE),
            Map.entry("OrgPlacesResource.update", WRITE),
            Map.entry("OrgPlacesResource.delete", WRITE)));

    /** A stand-in for another module whose maintainer once edited places too. */
    private record OtherModule(List<PermissionDef> permissions, List<RoleDef> roles) implements AccessCatalog {
    }

    @Test
    void everyEndpointNeedsOnlyItsPlacesPermission() {
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
                actual.put(name, String.join(" | ", allowed.value()));
            }
        }
        assertEquals(EXPECTED, actual);
        assertEquals("places:view", VIEW);
        assertEquals("places:write", WRITE);
    }

    @Test
    void eachRoleCanDoWhatItsNameSays() {
        AccessRegistry registry = registry();
        Set<String> viewer = member(registry, Set.of(PlacesAccessCatalog.VIEWER));
        Set<String> maintainer = member(registry, Set.of(PlacesAccessCatalog.MAINTAINER));

        assertTrue(viewer.contains(VIEW) && !viewer.contains(WRITE));
        assertTrue(maintainer.containsAll(Set.of(VIEW, WRITE)));
    }

    @Test
    void everyMemberViewsWithoutARoleButOnlyAMaintainerEdits() {
        AccessRegistry registry = registry();
        Set<String> member = member(registry, Set.of());
        assertTrue(member.contains(VIEW) && !member.contains(WRITE), "Lector is every member's default");

        Set<String> client = AccessRules.resolve(1L, "acme", Caller.client("acme-client"),
                new AccessRules.Facts(null, true, Set.of()), registry).permissions();
        assertTrue(client.contains(VIEW) && !client.contains(WRITE));

        Set<String> admin = AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(BaseRole.ADMIN, false, Set.of()), registry).permissions();
        assertTrue(admin.contains(WRITE), "an Admin holds every permission");
    }

    @Test
    void anotherModulesMaintainerDoesNotEditPlaces() {
        AccessRegistry registry = registry();
        Set<String> tower = member(registry, Set.of("TOWER_MAINTAINER"));
        assertTrue(tower.contains(VIEW), "still a member, so still a viewer");
        assertFalse(tower.contains(WRITE));
    }

    @Test
    void lugaresHasNoNoAccessOption() {
        Map<String, RoleDef> defaults = registry().memberDefaults();
        assertEquals(PlacesAccessCatalog.VIEWER, defaults.get(PlacesAccessCatalog.MODULE).key());
    }

    private static AccessRegistry registry() {
        AccessCatalog tower = new OtherModule(
                List.of(PermissionDef.of("tower:view", "Ver", "View")),
                List.of(RoleDef.of("TOWER_MAINTAINER", "tower", "Mantenedor", "Maintainer", Set.of("tower:view"))));
        return new AccessRegistry(List.of(new CoreAccessCatalog(), new PlacesAccessCatalog(), tower));
    }

    private static Set<String> member(AccessRegistry registry, Set<String> roles) {
        return AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(BaseRole.MEMBER, false, roles), registry).permissions();
    }

    private static boolean isEndpoint(Method method) {
        return method.isAnnotationPresent(GET.class) || method.isAnnotationPresent(POST.class)
                || method.isAnnotationPresent(PUT.class) || method.isAnnotationPresent(PATCH.class)
                || method.isAnnotationPresent(DELETE.class);
    }
}
