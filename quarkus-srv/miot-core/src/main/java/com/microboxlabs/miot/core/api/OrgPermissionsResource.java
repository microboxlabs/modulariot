package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.AuthorizationDecisionDto;
import com.microboxlabs.miot.core.permission.OrganizationPermissionService;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Whether the caller holds an application-owned organization permission. Holders are assigned on the Team page. */
@Path("/api/v1/orgs/{organizationId}/permissions/{permissionCode}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Permissions")
@SecurityRequirement(name = "oidc")
public class OrgPermissionsResource {

    private final OrganizationPermissionService service;

    @Inject
    public OrgPermissionsResource(OrganizationPermissionService service) {
        this.service = service;
    }

    @GET
    @Path("/me")
    @Operation(summary = "Whether the caller holds an application-owned organization permission")
    public Uni<AuthorizationDecisionDto> me(
            @PathParam("organizationId") String organizationId,
            @PathParam("permissionCode") String permissionCode) {
        return service.checkCurrentUser(organizationId, permissionCode);
    }
}
