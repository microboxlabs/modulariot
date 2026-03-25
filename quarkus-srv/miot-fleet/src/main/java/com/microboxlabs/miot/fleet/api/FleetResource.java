package com.microboxlabs.miot.fleet.api;

import com.microboxlabs.miot.fleet.model.Carrier;
import com.microboxlabs.miot.fleet.model.Trailer;
import com.microboxlabs.miot.fleet.model.Truck;
import com.microboxlabs.miot.fleet.model.Vehicle;
import io.quarkus.hibernate.reactive.panache.common.WithSession;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

@Path("/api/v1/fleet")
@Produces(MediaType.APPLICATION_JSON)
public class FleetResource {

    @GET
    @Path("/vehicles")
    @WithSession
    public Uni<List<Vehicle>> listVehicles() {
        return Vehicle.listAll();
    }

    @GET
    @Path("/trucks")
    @WithSession
    public Uni<List<Truck>> listTrucks() {
        return Truck.listAll();
    }

    @GET
    @Path("/trucks/{id}")
    @WithSession
    public Uni<Truck> getTruck(@PathParam("id") Long id) {
        return Truck.findById(id);
    }

    @GET
    @Path("/trailers")
    @WithSession
    public Uni<List<Trailer>> listTrailers() {
        return Trailer.listAll();
    }

    @GET
    @Path("/trailers/{id}")
    @WithSession
    public Uni<Trailer> getTrailer(@PathParam("id") Long id) {
        return Trailer.findById(id);
    }

    @GET
    @Path("/carriers")
    @WithSession
    public Uni<List<Carrier>> listCarriers() {
        return Carrier.listAll();
    }

    @GET
    @Path("/carriers/{id}")
    @WithSession
    public Uni<Carrier> getCarrier(@PathParam("id") Long id) {
        return Carrier.findById(id);
    }
}
