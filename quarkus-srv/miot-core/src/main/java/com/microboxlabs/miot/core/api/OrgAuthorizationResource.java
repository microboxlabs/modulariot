package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.AuthorizationCheckRequest;
import com.microboxlabs.miot.core.api.dto.AuthorizationDecisionDto;
import com.microboxlabs.miot.core.auth.M2MAuth;
import com.microboxlabs.miot.core.permission.OrganizationPermissionService;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Runtime authorization decisions for application services such as ecm-coordinator. */
@Path("/api/v1/orgs/{organizationId}/authorization/check")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Authorization")
@SecurityRequirement(name = "oidc")
@Authenticated
@M2MAuth
public class OrgAuthorizationResource {

    private final OrganizationPermissionService service;

    @Inject
    public OrgAuthorizationResource(OrganizationPermissionService service) {
        this.service = service;
    }

    @POST
    @Operation(summary = "Check whether an organization subject has an application permission")
    public Uni<AuthorizationDecisionDto> check(
            @PathParam("organizationId") String organizationId,
            AuthorizationCheckRequest request) {
        return service.check(organizationId, request);
    }
}
