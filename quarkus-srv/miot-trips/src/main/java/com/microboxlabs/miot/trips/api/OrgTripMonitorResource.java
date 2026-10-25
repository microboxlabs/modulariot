package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.domain.MonitorRun;
import com.microboxlabs.miot.trips.service.MonitorEngine;
import com.microboxlabs.miot.trips.service.TripService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The monitor of one trip: which version it follows, its timers, the signals it gets and what they did. */
@Path("/api/v1/orgs/{organizationId}/trips")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Monitors", description = "Versioned transition rules for each class of trip")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripMonitorResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String ID = "id";

    /**
     * A signal for the trip: {@code kind} such as {@code left_origin}; {@code at} defaults to now; {@code source}
     * names what produced it ({@code eta}), else it is a GPS detection.
     */
    public record SignalRequest(String kind, String geofenceId, OffsetDateTime at, String source) {
    }

    /** {@code version} null takes the newest published one. */
    public record BindRequest(String monitorKey, Integer version) {
    }

    public record MonitorView(MonitorRun.State state, List<MonitorRun.Timer> timers) {
    }

    private final MonitorEngine engine;
    private final TripService trips;

    @Inject
    public OrgTripMonitorResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            MonitorEngine engine,
            TripService trips) {
        super(tenantContext, organizationContext, roleService, identity);
        this.engine = engine;
        this.trips = trips;
    }

    @GET
    @Path("/trips/{id}/monitor")
    @Operation(operationId = "getTripMonitor", summary = "The monitor version the trip follows and its pending timers")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> {
            UUID tripId = trip(tenant, id);
            return Response.ok(new MonitorView(engine.state(tenant, tripId).orElse(null),
                    engine.pendingTimers(tenant, tripId))).build();
        });
    }

    @PUT
    @Path("/trips/{id}/monitor")
    @Operation(operationId = "bindTripMonitor",
            summary = "Moves an open trip to a monitor version (the newest published one when version is empty)")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> bind(@PathParam(ORG) String organizationId, @PathParam(ID) String id, BindRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            UUID tripId = trip(tenant, id);
            MonitorRun.State state = engine.bind(tenant, actor, tripId, body == null ? null : body.monitorKey(),
                    body == null ? null : body.version());
            return Response.ok(new MonitorView(state, engine.pendingTimers(tenant, tripId))).build();
        });
    }

    @POST
    @Path("/trips/{id}/signals")
    @Operation(operationId = "sendTripSignal",
            summary = "Delivers a signal to the trip's monitor and returns the transitions it caused")
    @PermissionsAllowed(value = TripsAccessCatalog.STAGE_OPERATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> signal(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            SignalRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            UUID tripId = trip(tenant, id);
            if (body == null) {
                throw new IllegalArgumentException("body is required");
            }
            return Response.ok(engine.signal(tenant, actor, tripId, body.kind(), body.geofenceId(), body.at(),
                    body.source())).build();
        });
    }

    @GET
    @Path("/trips/{id}/transitions")
    @Operation(operationId = "listTripTransitions",
            summary = "What each event did on the trip, newest first: rules matched, stages, actions, errors")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> transitions(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @QueryParam("limit") Integer limit) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(engine.transitions(tenant, trip(tenant, id), limit)).build());
    }

    private UUID trip(String tenant, String id) {
        UUID tripId = uuid(id, ID);
        trips.get(tenant, tripId);
        return tripId;
    }
}
