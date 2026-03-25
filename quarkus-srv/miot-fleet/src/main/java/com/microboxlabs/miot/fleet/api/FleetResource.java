package com.microboxlabs.miot.fleet.api;

import com.microboxlabs.miot.fleet.model.Vehicle;
import io.quarkus.hibernate.reactive.panache.common.WithSession;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
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
}
