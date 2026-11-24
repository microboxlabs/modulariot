package com.microboxlabs.miot.teltonika.access;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.ModuleDef;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/**
 * Permissions and roles of the directly connected devices (Ajustes › Integración GPS › Equipos
 * directos). Seeing devices, their health and the installation check is {@value #VIEWER}'s;
 * registering, assigning and deactivating them {@value #MAINTAINER}'s; sending commands and intensive
 * tracking {@value #OPERATOR}'s. An Admin or Owner holds all of them.
 *
 * <table>
 *   <caption>Roles</caption>
 *   <tr><th>Role</th><th>Permissions</th></tr>
 *   <tr><td>{@value #VIEWER}</td><td>{@value #VIEW}</td></tr>
 *   <tr><td>{@value #MAINTAINER}</td><td>+ {@value #WRITE}</td></tr>
 *   <tr><td>{@value #OPERATOR}</td><td>{@value #VIEW} + {@value #COMMAND}</td></tr>
 * </table>
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class DevicesAccessCatalog implements AccessCatalog {

    public static final String MODULE = "gps-devices";

    /** Seeing the devices, their health, packets, commands and installation check. */
    public static final String VIEW = "gps-devices:view";
    /** Registering, editing, assigning, capturing and deactivating devices. */
    public static final String WRITE = "gps-devices:write";
    /** Sending commands and starting or ending intensive tracking. */
    public static final String COMMAND = "gps-devices:command";

    public static final String VIEWER = "GPS_DEVICES_VIEWER";
    public static final String MAINTAINER = "GPS_DEVICES_MAINTAINER";
    public static final String OPERATOR = "GPS_DEVICES_OPERATOR";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(VIEW, "Ver equipos directos", "View direct devices"),
                PermissionDef.of(WRITE, "Administrar equipos directos", "Manage direct devices"),
                PermissionDef.of(COMMAND, "Enviar comandos a equipos", "Send device commands"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(VIEWER, MODULE, "Lector", "Viewer", Set.of(VIEW))
                        .describedAs("Ve los equipos conectados directo, su salud y la prueba de instalación.",
                                "Sees the directly connected devices, their health and the installation check."),
                RoleDef.of(MAINTAINER, MODULE, "Mantenedor", "Maintainer", Set.of(VIEW, WRITE))
                        .describedAs("Además registra equipos, los asigna a patentes y los da de baja.",
                                "Also registers devices, assigns them to assets and deactivates them."),
                RoleDef.of(OPERATOR, MODULE, "Operador", "Operator", Set.of(VIEW, COMMAND))
                        .describedAs("Además consulta los equipos y activa el seguimiento intensivo.",
                                "Also queries devices and starts intensive tracking."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(ModuleDef.of(MODULE, "Equipos directos", "Direct devices",
                "Los equipos GPS que la organización conecta directo a la plataforma.",
                "The GPS devices the organization connects directly to the platform."));
    }
}
