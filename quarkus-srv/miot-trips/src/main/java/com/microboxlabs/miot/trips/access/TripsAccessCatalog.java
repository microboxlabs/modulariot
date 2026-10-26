package com.microboxlabs.miot.trips.access;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.ModuleDef;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/**
 * The trips module's permissions and roles.
 *
 * <table>
 *   <caption>Roles</caption>
 *   <tr><th>Role</th><th>Permissions</th></tr>
 *   <tr><td>{@value #VIEWER}</td><td>{@value #VIEW}</td></tr>
 *   <tr><td>{@value #OPERATOR}</td><td>+ {@value #STAGE_OPERATE}, {@value #MILESTONE_CONFIRM},
 *       {@value #DELIVERY_OPERATE}, {@value #CARGO_OPERATE}, {@value #ASSIGNMENT_WRITE}</td></tr>
 *   <tr><td>{@value #MAINTAINER}</td><td>every trips permission but {@value #FEED_ADMIN} and
 *       {@value #MONITOR_ADMIN} (the feeds' service accounts use it)</td></tr>
 *   <tr><td>Owner, Admin</td><td>+ {@value #FEED_ADMIN}: the rules of each feed; {@value #MONITOR_ADMIN}: the
 *       trip monitors</td></tr>
 * </table>
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripsAccessCatalog implements AccessCatalog {

    public static final String MODULE = "trips";

    public static final String VIEW = "trips:view";
    public static final String MANDATE_WRITE = "trips:mandate.write";
    public static final String CARGO_OPERATE = "trips:cargo.operate";
    public static final String TRIP_WRITE = "trips:trip.write";
    public static final String STAGE_OPERATE = "trips:stage.operate";
    public static final String MILESTONE_CONFIRM = "trips:milestone.confirm";
    public static final String DELIVERY_OPERATE = "trips:delivery.operate";
    public static final String ASSIGNMENT_WRITE = "trips:assignment.write";
    public static final String LOCATION_WRITE = "trips:location.write";
    public static final String FEED_WRITE = "trips:feed.write";
    public static final String FEED_ADMIN = "trips:feed.admin";
    public static final String MONITOR_ADMIN = "trips:monitor.admin";

    public static final String VIEWER = "TRIPS_VIEWER";
    public static final String OPERATOR = "TRIPS_OPERATOR";
    public static final String MAINTAINER = "TRIPS_MAINTAINER";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(VIEW, "Ver mandatos y viajes", "View mandates and trips"),
                PermissionDef.of(MANDATE_WRITE, "Crear y cerrar mandatos", "Create and close mandates"),
                PermissionDef.of(CARGO_OPERATE, "Anunciar y recepcionar cargas", "Announce and receive cargo"),
                PermissionDef.of(TRIP_WRITE, "Crear y vincular viajes", "Create and link trips"),
                PermissionDef.of(STAGE_OPERATE, "Operar etapas y actividades", "Operate stages and activities"),
                PermissionDef.of(MILESTONE_CONFIRM, "Confirmar salidas, llegadas y cierres",
                        "Confirm departures, arrivals and closures"),
                PermissionDef.of(DELIVERY_OPERATE, "Registrar entregas, sus pruebas (POD) y sus pasos",
                        "Record deliveries, their proofs (POD) and their steps"),
                PermissionDef.of(ASSIGNMENT_WRITE, "Asignar recursos a viajes", "Assign resources to trips"),
                PermissionDef.of(LOCATION_WRITE, "Mantener ubicaciones", "Maintain locations"),
                PermissionDef.of(FEED_WRITE, "Enviar feeds de servicios", "Send service feeds"),
                PermissionDef.of(FEED_ADMIN, "Configurar las reglas de los feeds", "Configure the rules of feeds"),
                PermissionDef.of(MONITOR_ADMIN, "Configurar los monitores de viajes",
                        "Configure trip monitors"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(VIEWER, MODULE, "Lector", "Viewer", Set.of(VIEW))
                        .describedAs("Ve mandatos, viajes y su historia sin cambiar nada.",
                                "Sees mandates, trips and their history without changing anything."),
                RoleDef.of(OPERATOR, MODULE, "Operador", "Operator",
                                Set.of(VIEW, STAGE_OPERATE, MILESTONE_CONFIRM, DELIVERY_OPERATE, CARGO_OPERATE,
                                        ASSIGNMENT_WRITE))
                        .asLegacyDefault()
                        .describedAs("Opera las etapas, las cargas y los recursos de los viajes en curso.",
                                "Operates stages, cargo and resources of running trips."),
                RoleDef.of(MAINTAINER, MODULE, "Mantenedor", "Maintainer",
                                Set.of(VIEW, MANDATE_WRITE, CARGO_OPERATE, TRIP_WRITE, STAGE_OPERATE,
                                        MILESTONE_CONFIRM, DELIVERY_OPERATE, ASSIGNMENT_WRITE, LOCATION_WRITE,
                                        FEED_WRITE))
                        .describedAs("Además crea mandatos y viajes, mantiene recursos y ubicaciones y envía feeds.",
                                "Also creates mandates and trips, maintains resources and locations and sends feeds."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(ModuleDef.of(MODULE, "Viajes", "Trips",
                "Mandatos de carga y los viajes que los ejecutan.",
                "Cargo mandates and the trips that execute them."));
    }
}
