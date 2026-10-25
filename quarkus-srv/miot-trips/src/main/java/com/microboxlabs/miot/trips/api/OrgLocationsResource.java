package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.LocationGeofenceRequest;
import com.microboxlabs.miot.trips.dto.LocationRequest;
import com.microboxlabs.miot.trips.dto.LocationView;
import com.microboxlabs.miot.trips.service.LocationService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Locations: plant, port, distribution center, customer, zone; each may point at a GPS geofence. */
@Path("/api/v1/orgs/{organizationId}/trips/locations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Locations", description = "The named places trips and mandates point at")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgLocationsResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final LocationService locations;

    @Inject
    public OrgLocationsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            LocationService locations) {
        super(tenantContext, organizationContext, roleService, identity);
        this.locations = locations;
    }

    @GET
    @Operation(operationId = "listLocations", summary = "Locations by name/code and type")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(@PathParam(ORG) String organizationId, @QueryParam("q") String q,
            @QueryParam("type") String type, @QueryParam("page") String page, @QueryParam("size") String size) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                locations.list(tenant, q, type, integer(page, "page"), integer(size, "size")).stream().map(LocationView::of).toList()).build());
    }

    @POST
    @Operation(operationId = "createLocation", summary = "Registers a location")
    @PermissionsAllowed(value = TripsAccessCatalog.LOCATION_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> create(@PathParam(ORG) String organizationId, LocationRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(LocationView.of(locations.create(tenant, actor, body))).build());
    }

    @PATCH
    @Path("/{id}")
    @Operation(operationId = "updateLocation", summary = "Patches a location")
    @PermissionsAllowed(value = TripsAccessCatalog.LOCATION_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> update(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            LocationRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(
                LocationView.of(locations.update(tenant, actor, uuid(id, "id"), body))).build());
    }

    @PUT
    @Path("/{id}/geofence")
    @Operation(operationId = "linkLocationGeofence", summary = "Points a location at a GPS geofence, or at none")
    @PermissionsAllowed(value = TripsAccessCatalog.LOCATION_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> linkGeofence(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            LocationGeofenceRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        Integer geofenceId = body == null ? null : body.geofenceId();
        return work(() -> Response.ok(
                LocationView.of(locations.linkGeofence(tenant, actor, uuid(id, "id"), geofenceId))).build());
    }

    @GET
    @Path("/geofences")
    @Operation(operationId = "listLocationGeofences", summary = "The organization's GPS geofences by name or code")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> geofences(@PathParam(ORG) String organizationId, @QueryParam("q") String q,
            @QueryParam("size") String size) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(locations.geofences(tenant, q, integer(size, "size"))).build());
    }
}
