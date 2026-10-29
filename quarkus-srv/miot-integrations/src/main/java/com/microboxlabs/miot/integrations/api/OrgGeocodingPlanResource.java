package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SetSubscriptionRequest;
import com.microboxlabs.miot.integrations.service.GeocodingPlanService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * An organization's geocoding subscription and its usage in a month: resolutions by source and result, provider
 * calls against the quota, and cost. An owner of the org or a platform owner reads it; only a platform owner
 * changes the subscription, since it sets what the organization is charged.
 */
@Path("/api/v1/orgs/{organizationId}/geocoding-plan")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Geocoding Plan", description = "Geocoding quota and monthly usage")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgGeocodingPlanResource {

    private final GeocodingPlanService service;
    private final OrganizationRoleService roles;
    private final PlatformAuthorizer platformAuthorizer;

    @Inject
    public OrgGeocodingPlanResource(GeocodingPlanService service, OrganizationRoleService roles,
                                    PlatformAuthorizer platformAuthorizer) {
        this.service = service;
        this.roles = roles;
        this.platformAuthorizer = platformAuthorizer;
    }

    @GET
    @Operation(summary = "Plan, subscription and a month's geocoding usage",
            description = "month is YYYY-MM (UTC), the current one when left out.")
    public Uni<Response> get(@PathParam("organizationId") String organizationId, @QueryParam("month") String month) {
        return requireAdmin(organizationId).flatMap(ignored -> onWorker(() -> {
            try {
                return Response.ok(service.orgPlan(organizationId, Months.parse(month))).build();
            } catch (IllegalArgumentException e) {
                return PlatformGeocodingPlanResource.badRequest(e);
            }
        }));
    }

    @PUT
    @Operation(summary = "Set the organization's geocoding quota",
            description = "monthlyQuota null uses the plan's; onExhausted is review (default) or overage.")
    public Uni<Response> put(@PathParam("organizationId") String organizationId, SetSubscriptionRequest body) {
        return platformAuthorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return Response.ok(service.setSubscription(organizationId, body, actor)).build();
            } catch (IllegalArgumentException e) {
                return PlatformGeocodingPlanResource.badRequest(e);
            }
        }));
    }

    private Uni<Void> requireAdmin(String organizationId) {
        return roles.requireOwner(organizationId)
                .onFailure(ForbiddenException.class)
                .recoverWithUni(() -> platformAuthorizer.requirePlatformOwner().replaceWithVoid());
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
