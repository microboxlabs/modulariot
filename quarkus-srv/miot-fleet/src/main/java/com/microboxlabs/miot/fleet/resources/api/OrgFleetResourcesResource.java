package com.microboxlabs.miot.fleet.resources.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.fleet.access.FleetAccessCatalog;
import com.microboxlabs.miot.fleet.resources.dto.CarrierRequest;
import com.microboxlabs.miot.fleet.resources.dto.CarrierView;
import com.microboxlabs.miot.fleet.resources.dto.DriverRequest;
import com.microboxlabs.miot.fleet.resources.dto.DriverView;
import com.microboxlabs.miot.fleet.resources.dto.TrailerRequest;
import com.microboxlabs.miot.fleet.resources.dto.TrailerView;
import com.microboxlabs.miot.fleet.resources.dto.TruckRequest;
import com.microboxlabs.miot.fleet.resources.dto.TruckView;
import com.microboxlabs.miot.fleet.resources.service.ResourceService;
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
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The resource directory: carriers, trucks, trailers, drivers. No deletes — deactivate by status. */
@Path("/api/v1/orgs/{organizationId}/fleet/resources")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Fleet — Resources", description = "Carriers, trucks, trailers and drivers")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class OrgFleetResourcesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final ResourceService resources;

    @Inject
    public OrgFleetResourcesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            ResourceService resources) {
        super(tenantContext, organizationContext, roleService, identity);
        this.resources = resources;
    }

    // ---- carriers -------------------------------------------------------

    @GET
    @Path("/carriers")
    @Operation(operationId = "listCarriers", summary = "Carriers by rut or legal name")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> listCarriers(@PathParam(ORG) String organizationId, @QueryParam("q") String q,
            @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                resources.listCarriers(tenant, q, page, size).stream().map(CarrierView::of).toList()).build());
    }

    @POST
    @Path("/carriers")
    @Operation(operationId = "createCarrier", summary = "Registers a carrier")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> createCarrier(@PathParam(ORG) String organizationId, CarrierRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(CarrierView.of(resources.createCarrier(tenant, actor, body))).build());
    }

    @PATCH
    @Path("/carriers/{id}")
    @Operation(operationId = "updateCarrier", summary = "Patches a carrier; status deactivates it")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> updateCarrier(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            CarrierRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(
                CarrierView.of(resources.updateCarrier(tenant, actor, uuid(id, "id"), body))).build());
    }

    // ---- trucks ---------------------------------------------------------

    @GET
    @Path("/trucks")
    @Operation(operationId = "listTrucks", summary = "Trucks by plate or carrier")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> listTrucks(@PathParam(ORG) String organizationId, @QueryParam("plate") String plate,
            @QueryParam("carrierId") String carrierId, @QueryParam("page") Integer page,
            @QueryParam("size") Integer size) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                resources.listTrucks(tenant, plate, carrierId, page, size).stream().map(TruckView::of).toList())
                .build());
    }

    @POST
    @Path("/trucks")
    @Operation(operationId = "createTruck", summary = "Registers a truck under a carrier")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> createTruck(@PathParam(ORG) String organizationId, TruckRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(TruckView.of(resources.createTruck(tenant, actor, body))).build());
    }

    @PATCH
    @Path("/trucks/{id}")
    @Operation(operationId = "updateTruck", summary = "Patches a truck; status deactivates it")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> updateTruck(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            TruckRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(
                TruckView.of(resources.updateTruck(tenant, actor, uuid(id, "id"), body))).build());
    }

    // ---- trailers -------------------------------------------------------

    @GET
    @Path("/trailers")
    @Operation(operationId = "listTrailers", summary = "Trailers by plate")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> listTrailers(@PathParam(ORG) String organizationId, @QueryParam("plate") String plate,
            @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                resources.listTrailers(tenant, plate, page, size).stream().map(TrailerView::of).toList())
                .build());
    }

    @POST
    @Path("/trailers")
    @Operation(operationId = "createTrailer", summary = "Registers a trailer under a carrier")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> createTrailer(@PathParam(ORG) String organizationId, TrailerRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(TrailerView.of(resources.createTrailer(tenant, actor, body))).build());
    }

    @PATCH
    @Path("/trailers/{id}")
    @Operation(operationId = "updateTrailer", summary = "Patches a trailer; status deactivates it")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> updateTrailer(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            TrailerRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(
                TrailerView.of(resources.updateTrailer(tenant, actor, uuid(id, "id"), body))).build());
    }

    // ---- drivers --------------------------------------------------------

    @GET
    @Path("/drivers")
    @Operation(operationId = "listDrivers", summary = "Drivers by rut or name")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> listDrivers(@PathParam(ORG) String organizationId, @QueryParam("rut") String rut,
            @QueryParam("q") String q, @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                resources.listDrivers(tenant, rut, q, page, size).stream().map(DriverView::of).toList())
                .build());
    }

    @POST
    @Path("/drivers")
    @Operation(operationId = "createDriver", summary = "Registers a driver")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> createDriver(@PathParam(ORG) String organizationId, DriverRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(DriverView.of(resources.createDriver(tenant, actor, body))).build());
    }

    @PATCH
    @Path("/drivers/{id}")
    @Operation(operationId = "updateDriver", summary = "Patches a driver; status deactivates them")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> updateDriver(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            DriverRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(
                DriverView.of(resources.updateDriver(tenant, actor, uuid(id, "id"), body))).build());
    }
}
