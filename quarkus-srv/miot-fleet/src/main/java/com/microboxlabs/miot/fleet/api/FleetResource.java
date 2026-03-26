package com.microboxlabs.miot.fleet.api;

import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.fleet.dto.CreateCarrierRequest;
import com.microboxlabs.miot.fleet.dto.CreateTrailerRequest;
import com.microboxlabs.miot.fleet.dto.CreateTruckRequest;
import com.microboxlabs.miot.fleet.model.Carrier;
import com.microboxlabs.miot.fleet.model.Trailer;
import com.microboxlabs.miot.fleet.model.Truck;
import com.microboxlabs.miot.fleet.model.Vehicle;
import com.microboxlabs.miot.fleet.service.CarrierService;
import com.microboxlabs.miot.fleet.service.TrailerService;
import com.microboxlabs.miot.fleet.service.TruckService;
import com.microboxlabs.miot.resource.dto.StatusChangeRequest;
import com.microboxlabs.miot.resource.event.EntityEvent;
import com.microboxlabs.miot.resource.event.EntityEventService;
import com.microboxlabs.miot.resource.event.EntityType;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.hibernate.reactive.panache.common.WithSession;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
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

@Path("/api/v1/fleet")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Fleet", description = "Fleet resource directory: vehicles, trucks, trailers, carriers")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetResource {

    @Inject TenantContext tenantContext;
    @Inject TruckService truckService;
    @Inject TrailerService trailerService;
    @Inject CarrierService carrierService;
    @Inject EntityEventService eventService;

    // --- Vehicles (legacy, read-only) ---

    @GET
    @Path("/vehicles")
    @WithSession
    @Operation(summary = "List all vehicles")
    public Uni<List<Vehicle>> listVehicles() {
        return Vehicle.listAll();
    }

    // --- Trucks ---

    @GET
    @Path("/trucks")
    @Operation(summary = "List trucks")
    public Uni<List<Truck>> listTrucks(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("25") int size) {
        return truckService.list(tenantContext.getClientId(), page, size);
    }

    @GET
    @Path("/trucks/{id}")
    @Operation(summary = "Get truck by ID")
    public Uni<Response> getTruck(@PathParam("id") Long id) {
        return truckService.findById(tenantContext.getClientId(), id)
                .map(t -> t != null ? Response.ok(t).build() : Response.status(404).build());
    }

    @POST
    @Path("/trucks")
    @Operation(summary = "Create a truck")
    public Uni<Response> createTruck(CreateTruckRequest req) {
        return truckService.create(tenantContext.getClientId(), req, "api")
                .map(t -> Response.status(201).entity(t).build());
    }

    @PATCH
    @Path("/trucks/{id}/status")
    @Operation(summary = "Change truck status")
    public Uni<Response> changeTruckStatus(@PathParam("id") Long id, StatusChangeRequest req) {
        return truckService.changeStatus(tenantContext.getClientId(), id, req, "api")
                .map(t -> Response.ok(t).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> Response.status(404).entity("{\"error\":\"" + e.getMessage() + "\"}").build());
    }

    @GET
    @Path("/trucks/{id}/events")
    @Operation(summary = "Get truck event history")
    public Uni<List<EntityEvent>> getTruckEvents(
            @PathParam("id") Long id,
            @QueryParam("limit") @DefaultValue("50") int limit) {
        return truckService.findById(tenantContext.getClientId(), id)
                .flatMap(t -> t == null ? Uni.createFrom().item(List.<EntityEvent>of())
                        : eventService.listByEntity(EntityType.TRUCK, t.entityId, limit));
    }

    // --- Trailers ---

    @GET
    @Path("/trailers")
    @Operation(summary = "List trailers")
    public Uni<List<Trailer>> listTrailers(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("25") int size) {
        return trailerService.list(tenantContext.getClientId(), page, size);
    }

    @GET
    @Path("/trailers/{id}")
    @Operation(summary = "Get trailer by ID")
    public Uni<Response> getTrailer(@PathParam("id") Long id) {
        return trailerService.findById(tenantContext.getClientId(), id)
                .map(t -> t != null ? Response.ok(t).build() : Response.status(404).build());
    }

    @POST
    @Path("/trailers")
    @Operation(summary = "Create a trailer")
    public Uni<Response> createTrailer(CreateTrailerRequest req) {
        return trailerService.create(tenantContext.getClientId(), req, "api")
                .map(t -> Response.status(201).entity(t).build());
    }

    @PATCH
    @Path("/trailers/{id}/status")
    @Operation(summary = "Change trailer status")
    public Uni<Response> changeTrailerStatus(@PathParam("id") Long id, StatusChangeRequest req) {
        return trailerService.changeStatus(tenantContext.getClientId(), id, req, "api")
                .map(t -> Response.ok(t).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> Response.status(404).entity("{\"error\":\"" + e.getMessage() + "\"}").build());
    }

    @GET
    @Path("/trailers/{id}/events")
    @Operation(summary = "Get trailer event history")
    public Uni<List<EntityEvent>> getTrailerEvents(
            @PathParam("id") Long id,
            @QueryParam("limit") @DefaultValue("50") int limit) {
        return trailerService.findById(tenantContext.getClientId(), id)
                .flatMap(t -> t == null ? Uni.createFrom().item(List.<EntityEvent>of())
                        : eventService.listByEntity(EntityType.TRAILER, t.entityId, limit));
    }

    // --- Carriers ---

    @GET
    @Path("/carriers")
    @Operation(summary = "List carriers")
    public Uni<List<Carrier>> listCarriers(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("25") int size) {
        return carrierService.list(tenantContext.getClientId(), page, size);
    }

    @GET
    @Path("/carriers/{id}")
    @Operation(summary = "Get carrier by ID")
    public Uni<Response> getCarrier(@PathParam("id") Long id) {
        return carrierService.findById(tenantContext.getClientId(), id)
                .map(c -> c != null ? Response.ok(c).build() : Response.status(404).build());
    }

    @POST
    @Path("/carriers")
    @Operation(summary = "Create a carrier")
    public Uni<Response> createCarrier(CreateCarrierRequest req) {
        return carrierService.create(tenantContext.getClientId(), req, "api")
                .map(c -> Response.status(201).entity(c).build());
    }

    @PATCH
    @Path("/carriers/{id}/status")
    @Operation(summary = "Change carrier status")
    public Uni<Response> changeCarrierStatus(@PathParam("id") Long id, StatusChangeRequest req) {
        return carrierService.changeStatus(tenantContext.getClientId(), id, req, "api")
                .map(c -> Response.ok(c).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> Response.status(404).entity("{\"error\":\"" + e.getMessage() + "\"}").build());
    }

    @GET
    @Path("/carriers/{id}/events")
    @Operation(summary = "Get carrier event history")
    public Uni<List<EntityEvent>> getCarrierEvents(
            @PathParam("id") Long id,
            @QueryParam("limit") @DefaultValue("50") int limit) {
        return carrierService.findById(tenantContext.getClientId(), id)
                .flatMap(c -> c == null ? Uni.createFrom().item(List.<EntityEvent>of())
                        : eventService.listByEntity(EntityType.CARRIER, c.entityId, limit));
    }
}
