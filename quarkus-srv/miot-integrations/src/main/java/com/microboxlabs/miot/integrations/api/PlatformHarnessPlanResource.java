package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.SetPlanRequest;
import com.microboxlabs.miot.integrations.service.HarnessPlanService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The harness seat plan every organization buys on. Only a platform owner reads or changes it. */
@Path("/api/v1/platform/harness-plan")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Harness Plan", description = "Seat price and tokens per seat")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformHarnessPlanResource {

    private final HarnessPlanService service;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformHarnessPlanResource(HarnessPlanService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(summary = "Read the seat plan")
    public Uni<Plan> get() {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(service::plan));
    }

    @PUT
    @Operation(summary = "Change the seat plan",
            description = "seatPriceUsd is per seat per month; tokensPerSeat is added to the monthly pool.")
    public Uni<Response> put(SetPlanRequest body) {
        return authorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return Response.ok(service.setPlan(body, actor)).build();
            } catch (IllegalArgumentException e) {
                return Response.status(Response.Status.BAD_REQUEST).type(MediaType.APPLICATION_JSON)
                        .entity(Map.of("error", e.getMessage())).build();
            }
        }));
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
