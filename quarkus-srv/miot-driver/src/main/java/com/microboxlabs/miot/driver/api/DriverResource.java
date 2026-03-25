package com.microboxlabs.miot.driver.api;

import com.microboxlabs.miot.driver.model.Driver;
import io.quarkus.hibernate.reactive.panache.common.WithSession;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

@Path("/api/v1/drivers")
@Produces(MediaType.APPLICATION_JSON)
public class DriverResource {

    @GET
    @WithSession
    public Uni<List<Driver>> listDrivers() {
        return Driver.listAll();
    }

    @GET
    @Path("/{id}")
    @WithSession
    public Uni<Driver> getDriver(@PathParam("id") Long id) {
        return Driver.findById(id);
    }
}
