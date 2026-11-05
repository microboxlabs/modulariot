package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Objects;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The organization's managed telephony in a month: minutes against its quota, and what the plan charges, without
 * the platform's provider cost. An owner of the organization or a platform owner reads it.
 */
@Path("/api/v1/orgs/{organizationId}/telephony-usage")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Telephony Usage", description = "Managed telephony minutes of the month")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgTelephonyUsageResource {

    private final TelephonyPlanService service;
    private final OrganizationRoleService roles;
    private final PlatformAuthorizer platformAuthorizer;
    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;

    @Inject
    public OrgTelephonyUsageResource(TelephonyPlanService service, OrganizationRoleService roles,
            PlatformAuthorizer platformAuthorizer, TenantContext tenantContext,
            OrganizationContext organizationContext) {
        this.service = service;
        this.roles = roles;
        this.platformAuthorizer = platformAuthorizer;
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
    }

    @GET
    @Operation(summary = "Plan, the organization's minutes and a month's managed telephony",
            description = "month is YYYY-MM (UTC), the current one when left out.")
    public Uni<Response> get(@PathParam("organizationId") String organizationId, @QueryParam("month") String month) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            return Uni.createFrom().item(Response.status(Response.Status.FORBIDDEN)
                    .entity(Map.of("error", "Organization context does not match request path")).build());
        }
        String tenant = tenantContext.getTenantCode() != null ? tenantContext.getTenantCode()
                : tenantContext.getClientId();
        return roles.requireOwner(organizationId)
                .onFailure(ForbiddenException.class)
                .recoverWithUni(() -> platformAuthorizer.requirePlatformOwner().replaceWithVoid())
                .flatMap(ignored -> Uni.createFrom().item(() -> {
                    try {
                        return Response.ok(service.orgPlan(tenant, Months.parse(month))).build();
                    } catch (IllegalArgumentException e) {
                        return PlatformGeocodingPlanResource.badRequest(e);
                    }
                }).runSubscriptionOn(Infrastructure.getDefaultWorkerPool()));
    }
}
