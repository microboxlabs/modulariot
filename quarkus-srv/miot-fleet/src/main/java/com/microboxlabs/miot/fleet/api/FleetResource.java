package com.microboxlabs.miot.fleet.api;

import com.microboxlabs.miot.fleet.model.Carrier;
import com.microboxlabs.miot.fleet.model.Trailer;
import com.microboxlabs.miot.fleet.model.Truck;
import com.microboxlabs.miot.fleet.model.Vehicle;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.hibernate.reactive.panache.common.WithSession;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/v1/fleet")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Fleet", description = "Fleet resource directory: vehicles, trucks, trailers, carriers")
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetResource {

    @GET
    @Path("/vehicles")
    @WithSession
    @Operation(summary = "List all vehicles")
    public Uni<List<Vehicle>> listVehicles() {
        return Vehicle.listAll();
    }

    @GET
    @Path("/trucks")
    @WithSession
    @Operation(summary = "List all trucks")
    public Uni<List<Truck>> listTrucks() {
        return Truck.listAll();
    }

    @GET
    @Path("/trucks/{id}")
    @WithSession
    @Operation(summary = "Get truck by ID")
    public Uni<Truck> getTruck(@PathParam("id") Long id) {
        return Truck.findById(id);
    }

    @GET
    @Path("/trailers")
    @WithSession
    @Operation(summary = "List all trailers")
    public Uni<List<Trailer>> listTrailers() {
        return Trailer.listAll();
    }

    @GET
    @Path("/trailers/{id}")
    @WithSession
    @Operation(summary = "Get trailer by ID")
    public Uni<Trailer> getTrailer(@PathParam("id") Long id) {
        return Trailer.findById(id);
    }

    @GET
    @Path("/carriers")
    @WithSession
    @Operation(summary = "List all carriers")
    public Uni<List<Carrier>> listCarriers() {
        return Carrier.listAll();
    }

    @GET
    @Path("/carriers/{id}")
    @WithSession
    @Operation(summary = "Get carrier by ID")
    public Uni<Carrier> getCarrier(@PathParam("id") Long id) {
        return Carrier.findById(id);
    }
}
