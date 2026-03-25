package com.microboxlabs.miot.driver.api;

import com.microboxlabs.miot.driver.model.Driver;
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

@Path("/api/v1/drivers")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Drivers", description = "Driver resource directory: lifecycle, documents, compliance, scoring")
@IfBuildProperty(name = "miot.component.driver.enabled", stringValue = "true")
public class DriverResource {

    @GET
    @WithSession
    @Operation(summary = "List all drivers")
    public Uni<List<Driver>> listDrivers() {
        return Driver.listAll();
    }

    @GET
    @Path("/{id}")
    @WithSession
    @Operation(summary = "Get driver by ID")
    public Uni<Driver> getDriver(@PathParam("id") Long id) {
        return Driver.findById(id);
    }
}
