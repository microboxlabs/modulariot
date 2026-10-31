package com.microboxlabs.miot.places.access;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.ModuleDef;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/**
 * The places module's permissions and roles.
 *
 * <table>
 *   <caption>Roles</caption>
 *   <tr><th>Role</th><th>Permissions</th></tr>
 *   <tr><td>{@value #VIEWER}</td><td>{@value #VIEW}</td></tr>
 *   <tr><td>{@value #MAINTAINER}</td><td>+ {@value #GEOFENCE_WRITE}</td></tr>
 * </table>
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class PlacesAccessCatalog implements AccessCatalog {

    public static final String MODULE = "places";

    public static final String VIEW = "places:view";
    public static final String GEOFENCE_WRITE = "places:geofence.write";

    public static final String VIEWER = "PLACES_VIEWER";
    public static final String MAINTAINER = "PLACES_MAINTAINER";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(VIEW, "Ver lugares y geocercas", "View places and geofences"),
                PermissionDef.of(GEOFENCE_WRITE, "Mantener geocercas", "Maintain geofences"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(VIEWER, MODULE, "Lector", "Viewer", Set.of(VIEW))
                        .asLegacyDefault()
                        .describedAs("Ve los lugares y sus geocercas sin cambiar nada.",
                                "Sees places and their geofences without changing anything."),
                RoleDef.of(MAINTAINER, MODULE, "Mantenedor", "Maintainer", Set.of(VIEW, GEOFENCE_WRITE))
                        .describedAs("Además crea, cambia y elimina geocercas.",
                                "Also creates, changes and deletes geofences."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(ModuleDef.of(MODULE, "Lugares", "Places",
                "Las geocercas y trayectos de la organización.",
                "The organization's geofences and routes."));
    }
}
