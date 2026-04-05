package com.microboxlabs.miot.driver.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.driver.dto.CreateDriverRequest;
import com.microboxlabs.miot.driver.dto.UpdateDriverRequest;
import com.microboxlabs.miot.driver.model.Driver;
import com.microboxlabs.miot.driver.service.DriverService;
import com.microboxlabs.miot.resource.dto.StatusChangeRequest;
import com.microboxlabs.miot.resource.event.EntityEvent;
import com.microboxlabs.miot.resource.event.EntityEventService;
import com.microboxlabs.miot.resource.event.EntityType;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
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
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/v1/orgs/{organizationId}/drivers")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Drivers", description = "Driver resource directory: lifecycle, documents, compliance, scoring")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.driver.enabled", stringValue = "true")
public class OrgDriverResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final DriverService driverService;
    private final EntityEventService eventService;

    @Inject
    public OrgDriverResource(TenantContext tenantContext, OrganizationContext organizationContext,
            DriverService driverService, EntityEventService eventService) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.driverService = driverService;
        this.eventService = eventService;
    }

    @GET
    @Operation(summary = "List drivers")
    public Uni<List<Driver>> listDrivers(
            @PathParam("organizationId") String organizationId,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("25") int size) {
        return driverService.list(tenantContext.getEffectiveClientIds(), page, size);
    }

    @GET
    @Path("/{id}")
    @Operation(summary = "Get driver by ID")
    public Uni<Response> getDriver(
            @PathParam("organizationId") String organizationId,
            @PathParam("id") Long id) {
        return driverService.findById(tenantContext.getEffectiveClientIds(), id)
                .map(driver -> driver != null
                        ? Response.ok(driver).build()
                        : Response.status(Response.Status.NOT_FOUND).build());
    }

    @POST
    @Operation(summary = "Create a driver")
    public Uni<Response> createDriver(
            @PathParam("organizationId") String organizationId,
            CreateDriverRequest req) {
        return driverService.create(tenantContext.getClientId(), req, organizationContext.getUserEmail())
                .map(driver -> Response.status(Response.Status.CREATED).entity(driver).build());
    }

    @PUT
    @Path("/{id}")
    @Operation(summary = "Update a driver")
    public Uni<Response> updateDriver(
            @PathParam("organizationId") String organizationId,
            @PathParam("id") Long id,
            UpdateDriverRequest req) {
        return driverService.update(tenantContext.getEffectiveClientIds(), id, req, organizationContext.getUserEmail())
                .map(driver -> Response.ok(driver).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\":\"" + e.getMessage() + "\"}").build());
    }

    @PATCH
    @Path("/{id}/status")
    @Operation(summary = "Change driver status")
    public Uni<Response> changeStatus(
            @PathParam("organizationId") String organizationId,
            @PathParam("id") Long id,
            StatusChangeRequest req) {
        return driverService.changeStatus(tenantContext.getEffectiveClientIds(), id, req, organizationContext.getUserEmail())
                .map(driver -> Response.ok(driver).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\":\"" + e.getMessage() + "\"}").build());
    }

    @GET
    @Path("/{id}/events")
    @Operation(summary = "Get driver event history")
    public Uni<List<EntityEvent>> getEvents(
            @PathParam("organizationId") String organizationId,
            @PathParam("id") Long id,
            @QueryParam("limit") @DefaultValue("50") int limit) {
        return driverService.findById(tenantContext.getEffectiveClientIds(), id)
                .flatMap(driver -> {
                    if (driver == null) return Uni.createFrom().item(List.<EntityEvent>of());
                    return eventService.listByEntity(EntityType.DRIVER, driver.entityId, limit);
                });
    }
}
