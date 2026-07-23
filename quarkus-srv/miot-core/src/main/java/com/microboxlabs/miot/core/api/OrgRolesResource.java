package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.OrganizationRoleDto;
import com.microboxlabs.miot.core.api.dto.SetOrganizationRoleRequest;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
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

/** Generic organization role administration API. */
@Path("/api/v1/orgs/{organizationId}/roles/{roleCode}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Roles")
@SecurityRequirement(name = "oidc")
public class OrgRolesResource {

    private final OrganizationRoleService service;

    @Inject
    public OrgRolesResource(OrganizationRoleService service) {
        this.service = service;
    }

    @GET
    @Operation(summary = "Get an application-owned organization role")
    public Uni<OrganizationRoleDto> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("roleCode") String roleCode) {
        return service.get(organizationId, roleCode);
    }

    @PUT
    @Operation(summary = "Replace an application-owned organization role")
    public Uni<OrganizationRoleDto> replace(
            @PathParam("organizationId") String organizationId,
            @PathParam("roleCode") String roleCode,
            SetOrganizationRoleRequest request) {
        return service.replace(organizationId, roleCode, request);
    }
}
