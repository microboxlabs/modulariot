package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SetPlanRequest;
import com.microboxlabs.miot.integrations.service.GeocodingPlanService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The geocoding plan every organization subscribes to, and every organization's month. Platform owner only. */
@Path("/api/v1/platform/geocoding-plan")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Geocoding Plan", description = "Geocoding quota, prices and usage per organization")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformGeocodingPlanResource {

    private final GeocodingPlanService service;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformGeocodingPlanResource(GeocodingPlanService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(summary = "Read the geocoding plan")
    public Uni<Plan> get() {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(service::plan));
    }

    @PUT
    @Operation(summary = "Change the geocoding plan",
            description = "resolutionsPerMonth is the quota of provider calls of a subscription without its own;"
                    + " overagePriceUsd is per call over it; alertPct is the share that warns the organization.")
    public Uni<Response> put(SetPlanRequest body) {
        return authorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return Response.ok(service.setPlan(body, actor)).build();
            } catch (IllegalArgumentException e) {
                return badRequest(e);
            }
        }));
    }

    @GET
    @Path("/usage")
    @Operation(summary = "Geocoding usage of every organization in a month",
            description = "month is YYYY-MM (UTC), the current one when left out.")
    public Uni<Response> usage(@QueryParam("month") String month) {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(() -> {
            try {
                return Response.ok(Map.of("organizations", service.allUsage(Months.parse(month)))).build();
            } catch (IllegalArgumentException e) {
                return badRequest(e);
            }
        }));
    }

    static Response badRequest(IllegalArgumentException e) {
        return Response.status(Response.Status.BAD_REQUEST).type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", e.getMessage())).build();
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
