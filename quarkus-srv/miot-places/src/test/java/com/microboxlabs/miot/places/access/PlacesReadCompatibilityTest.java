package com.microboxlabs.miot.places.access;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.AccessRegistry;
import com.microboxlabs.miot.core.iam.AccessRules;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import com.microboxlabs.miot.places.api.OrgGeofencesResource;
import io.quarkus.security.PermissionsAllowed;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PlacesReadCompatibilityTest {

    private record TowerCatalog(List<PermissionDef> permissions, List<RoleDef> roles) implements AccessCatalog {
    }

    @Test
    void existingNativeTowerViewersKeepReadAccessWithoutABackfill() throws NoSuchMethodException {
        AccessCatalog tower = new TowerCatalog(
                List.of(PermissionDef.of(PlacesAccessCatalog.CONTROL_TOWER_VIEW, "Ver torre", "View tower")),
                List.of(RoleDef.of("CONTROL_TOWER_VIEWER", "tower", "Lector", "Viewer",
                        Set.of(PlacesAccessCatalog.CONTROL_TOWER_VIEW))));
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog(), new PlacesAccessCatalog(), tower));
        var existing = AccessRules.resolve(1L, "acme", Caller.user("ana@example.com"),
                new AccessRules.Facts(BaseRole.MEMBER, false, Set.of("CONTROL_TOWER_VIEWER")), registry);
        assertFalse(existing.can(PlacesAccessCatalog.VIEW), "the member has no new Places binding");
        PermissionsAllowed allowed = OrgGeofencesResource.class
                .getMethod("list", String.class, String.class, String.class, String.class)
                .getAnnotation(PermissionsAllowed.class);
        assertFalse(allowed.inclusive());
        assertTrue(List.of(allowed.value()).stream().anyMatch(existing::can));
    }
}
