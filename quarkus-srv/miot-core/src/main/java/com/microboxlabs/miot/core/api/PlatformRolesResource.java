package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.PlatformRoleDto;
import com.microboxlabs.miot.core.api.dto.PlatformRoleMembershipDto;
import com.microboxlabs.miot.core.api.dto.SetPlatformRoleRequest;
import com.microboxlabs.miot.core.permission.PlatformRoleService;
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

/**
 * Platform-scope role administration, mirroring {@link OrgRolesResource} for
 * roles that belong to no organization.
 */
@Path("/api/v1/platform/roles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Roles")
@SecurityRequirement(name = "oidc")
public class PlatformRolesResource {

    private final PlatformRoleService service;

    @Inject
    public PlatformRolesResource(PlatformRoleService service) {
        this.service = service;
    }

    /**
     * Deliberately not restricted to platform owners: a client needs this to
     * decide whether to offer the administration surface at all, and a
     * non-owner simply gets an empty list.
     */
    @GET
    @Path("/me")
    @Operation(summary = "List the platform roles the caller holds")
    public Uni<PlatformRoleMembershipDto> myRoles() {
        return service.rolesOfCaller();
    }

    @GET
    @Path("/{roleCode}")
    @Operation(summary = "Get a platform role's assignees")
    public Uni<PlatformRoleDto> get(@PathParam("roleCode") String roleCode) {
        return service.get(roleCode);
    }

    @PUT
    @Path("/{roleCode}")
    @Operation(summary = "Replace a platform role's database assignees")
    public Uni<PlatformRoleDto> replace(
            @PathParam("roleCode") String roleCode, SetPlatformRoleRequest request) {
        return service.replace(roleCode, request);
    }
}
