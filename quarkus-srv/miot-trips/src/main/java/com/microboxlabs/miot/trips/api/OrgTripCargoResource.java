package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.TripCargoRequest;
import com.microboxlabs.miot.trips.dto.TripCargoView;
import com.microboxlabs.miot.trips.service.TripCargoService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Cargo on a trip: the physical link; a trigger keeps the contractual link consistent. */
@Path("/api/v1/orgs/{organizationId}/trips/trips/{id}/cargo")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Trip cargo", description = "Mount, place and unmount cargo on a trip")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripCargoResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final TripCargoService tripCargo;

    @Inject
    public OrgTripCargoResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            TripCargoService tripCargo) {
        super(tenantContext, organizationContext, roleService, identity);
        this.tripCargo = tripCargo;
    }

    @POST
    @Operation(operationId = "mountCargo",
            summary = "Mounts a cargo unit; the owning mandate gets linked to the trip (trigger)")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> mount(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            TripCargoRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(TripCargoView.of(tripCargo.mount(tenant, actor, uuid(id, "id"), body))).build());
    }

    @PATCH
    @Path("/{cargoId}")
    @Operation(operationId = "placeCargo", summary = "Sets at which stages the cargo loads and unloads")
    @PermissionsAllowed(value = TripsAccessCatalog.STAGE_OPERATE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> place(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            @PathParam("cargoId") String cargoId, TripCargoRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(TripCargoView.of(
                tripCargo.setStages(tenant, actor, uuid(id, "id"), uuid(cargoId, "cargoId"), body))).build());
    }

    @DELETE
    @Path("/{cargoId}")
    @Operation(operationId = "unmountCargo", summary = "Unmounts; 409 once the cargo was picked up")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> unmount(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            @PathParam("cargoId") String cargoId) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            tripCargo.unmount(tenant, actor, uuid(id, "id"), uuid(cargoId, "cargoId"));
            return Response.noContent().build();
        });
    }
}
