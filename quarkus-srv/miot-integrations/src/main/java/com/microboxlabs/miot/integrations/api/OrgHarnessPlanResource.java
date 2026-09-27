package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.auth.WriteAuthorizer;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.OrgPlanResponse;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.SetSubscriptionRequest;
import com.microboxlabs.miot.integrations.service.HarnessPlanService;
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
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * An organization's harness seats, who may use the harness, and this month's
 * token pool. Reading and changing both need SITE_MANAGER on the parent org, as
 * other organization settings do, or the platform owner role.
 *
 * <p>Not under {@code /harness}: that prefix is the run proxy in miot-core.
 */
@Path("/api/v1/orgs/{organizationId}/harness-plan")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Harness Plan", description = "Harness seats, access and token pool")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgHarnessPlanResource {

    private final HarnessPlanService service;
    private final WriteAuthorizer authorizer;
    private final PlatformAuthorizer platformAuthorizer;
    private final OrganizationContext organizationContext;

    @Inject
    public OrgHarnessPlanResource(HarnessPlanService service, WriteAuthorizer authorizer,
                                  PlatformAuthorizer platformAuthorizer,
                                  OrganizationContext organizationContext) {
        this.service = service;
        this.authorizer = authorizer;
        this.platformAuthorizer = platformAuthorizer;
        this.organizationContext = organizationContext;
    }

    @GET
    @Operation(summary = "Seats, access and this month's token pool")
    public Uni<OrgPlanResponse> get(@PathParam("organizationId") String organizationId) {
        return requireAdmin(organizationId)
                .flatMap(ignored -> onWorker(() -> service.orgPlan(organizationId)));
    }

    @PUT
    @Operation(summary = "Set the seats, billing cycle and who may use the harness",
            description = "accessMode is all, some or none; members lists the emails allowed when it is some.")
    public Uni<Response> put(@PathParam("organizationId") String organizationId, SetSubscriptionRequest body) {
        String actor = organizationContext.getUserEmail();
        return requireAdmin(organizationId).flatMap(ignored -> onWorker(() -> {
            try {
                return Response.ok(service.setSubscription(organizationId, body, actor)).build();
            } catch (IllegalArgumentException e) {
                return Response.status(Response.Status.BAD_REQUEST).type(MediaType.APPLICATION_JSON)
                        .entity(Map.of("error", e.getMessage())).build();
            }
        }));
    }

    private Uni<Void> requireAdmin(String organizationId) {
        return authorizer.requireParentSiteManager(organizationId)
                .onFailure(ForbiddenException.class)
                .recoverWithUni(() -> platformAuthorizer.requirePlatformOwner().replaceWithVoid());
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
