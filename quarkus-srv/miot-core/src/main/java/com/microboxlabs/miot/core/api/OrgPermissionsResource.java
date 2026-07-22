package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.OrganizationPermissionDto;
import com.microboxlabs.miot.core.api.dto.SetOrganizationPermissionRequest;
import com.microboxlabs.miot.core.permission.OrganizationPermissionService;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Generic organization permission administration API. */
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
    @Operation(summary = "Get an application-owned organization permission")
    public Uni<OrganizationPermissionDto> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("permissionCode") String permissionCode) {
        return service.get(organizationId, permissionCode);
    }

    @PUT
    @Operation(summary = "Replace an application-owned organization permission")
    public Uni<OrganizationPermissionDto> replace(
            @PathParam("organizationId") String organizationId,
            @PathParam("permissionCode") String permissionCode,
            SetOrganizationPermissionRequest request) {
        return service.replace(organizationId, permissionCode, request);
    }
}
