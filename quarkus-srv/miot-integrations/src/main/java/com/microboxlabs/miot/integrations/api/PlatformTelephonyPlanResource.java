package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Plan;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.SetSubscriptionRequest;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The managed telephony plan, every organization's month, and each organization's minutes. Platform owner only. */
@Path("/api/v1/platform/telephony-plan")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Telephony Plan", description = "Managed telephony prices, minutes and usage per organization")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformTelephonyPlanResource {

    private final TelephonyPlanService service;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformTelephonyPlanResource(TelephonyPlanService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(summary = "Read the telephony plan")
    public Uni<Plan> get() {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(service::plan));
    }

    @PUT
    @Operation(summary = "Change the telephony plan",
            description = "Prices are USD per billed minute (clMobileUsd, clLandlineUsd, otherUsd, whatsappCallUsd)"
                    + " or per template (whatsappTemplateUsd); minutesPerMonth is the default quota.")
    public Uni<Response> put(Plan body) {
        return authorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return Response.ok(service.setPlan(body, actor)).build();
            } catch (IllegalArgumentException e) {
                return PlatformGeocodingPlanResource.badRequest(e);
            }
        }));
    }

    @GET
    @Path("/usage")
    @Operation(summary = "Managed telephony usage of every organization in a month",
            description = "month is YYYY-MM (UTC), the current one when left out. Includes the provider's cost.")
    public Uni<Response> usage(@QueryParam("month") String month) {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(() -> {
            try {
                return Response.ok(Map.of("organizations", service.allUsage(Months.parse(month)))).build();
            } catch (IllegalArgumentException e) {
                return PlatformGeocodingPlanResource.badRequest(e);
            }
        }));
    }

    @PUT
    @Path("/organizations/{tenantCode}")
    @Operation(summary = "Set an organization's monthly minutes", description = "monthlyMinutes null uses the plan's.")
    public Uni<Response> setMinutes(@PathParam("tenantCode") String tenantCode, SetSubscriptionRequest body) {
        return authorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return Response.ok(service.setSubscription(tenantCode, body == null ? null : body.monthlyMinutes(),
                        actor)).build();
            } catch (IllegalArgumentException e) {
                return PlatformGeocodingPlanResource.badRequest(e);
            }
        }));
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
