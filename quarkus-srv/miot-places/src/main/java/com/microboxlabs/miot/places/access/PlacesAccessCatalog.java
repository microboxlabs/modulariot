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
 * The places module's permissions and roles; access to Lugares is decided by these alone. Every member sees the
 * organization's places ({@value #VIEWER} is the member default, so the module has no "no access"); editing them is
 * {@value #MAINTAINER}'s, or an Admin's or Owner's.
 *
 * <table>
 *   <caption>Roles</caption>
 *   <tr><th>Role</th><th>Permissions</th></tr>
 *   <tr><td>{@value #VIEWER} (every member)</td><td>{@value #VIEW}</td></tr>
 *   <tr><td>{@value #MAINTAINER}</td><td>+ {@value #WRITE}</td></tr>
 * </table>
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class PlacesAccessCatalog implements AccessCatalog {

    public static final String MODULE = "places";

    /** Seeing places (geofences, inner geofences, routes) and the organization's GPS geofences. */
    public static final String VIEW = "places:view";
    /** Creating, changing and deleting places (geofences, inner geofences, routes). */
    public static final String WRITE = "places:write";

    public static final String VIEWER = "PLACES_VIEWER";
    public static final String MAINTAINER = "PLACES_MAINTAINER";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(VIEW, "Ver lugares", "View places"),
                PermissionDef.of(WRITE, "Editar lugares", "Edit places"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(VIEWER, MODULE, "Lector", "Viewer", Set.of(VIEW))
                        .asMemberDefault()
                        .describedAs("Ve los lugares: geocercas, geocercas internas y trayectos. Todo miembro lo tiene.",
                                "Sees places: geofences, inner geofences and routes. Every member has it."),
                RoleDef.of(MAINTAINER, MODULE, "Mantenedor", "Maintainer", Set.of(VIEW, WRITE))
                        .describedAs("Además crea, cambia y elimina geocercas, geocercas internas y trayectos.",
                                "Also creates, changes and deletes geofences, inner geofences and routes."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(ModuleDef.of(MODULE, "Lugares", "Places",
                "Las geocercas y trayectos de la organización.",
                "The organization's geofences and routes."));
    }
}
