package com.microboxlabs.miot.assignment.api;

import com.microboxlabs.miot.assignment.dto.CarrierSearchRequest;
import com.microboxlabs.miot.assignment.dto.CarrierSearchResponse;
import com.microboxlabs.miot.assignment.dto.ResourceSearchRequest;
import com.microboxlabs.miot.assignment.dto.ResourceSearchResponse;
import com.microboxlabs.miot.assignment.service.TripResourceAssignmentService;
import com.microboxlabs.miot.core.auth.TenantContext;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/v1/trip-resource-assignments")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trip Resource Assignments", description = "Resource candidate lookup for booked trip assignment")
@SecurityRequirement(name = "oidc")
public class TripResourceAssignmentResource {

    @Inject
    TenantContext tenantContext;

    @Inject
    TripResourceAssignmentService assignmentService;

    @POST
    @Path("/carriers/search")
    @Operation(summary = "Search carrier candidates for a booked trip")
    public Uni<CarrierSearchResponse> searchCarriers(CarrierSearchRequest request) {
        return assignmentService.searchCarriers(tenantContext.getClientId(), request);
    }

    @POST
    @Path("/resources/search")
    @Operation(summary = "Search driver, truck, and trailer candidates for a selected carrier")
    public Uni<ResourceSearchResponse> searchResources(ResourceSearchRequest request) {
        return assignmentService.searchResources(tenantContext.getClientId(), request);
    }
}
