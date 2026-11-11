package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.CustomRoles;
import com.microboxlabs.miot.core.iam.CustomRoles.RoleRequest;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.OrgPermission;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The organization's custom roles. Any member lists them; only an Owner or Admin changes them, which the service
 * checks on the caller's base role, because a custom role could itself hold any permission.
 */
@Path("/api/v1/orgs/{organizationId}/team/custom-roles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Team", description = "Members, their roles, and invitations")
@SecurityRequirement(name = "oidc")
@Authenticated
public class OrgCustomRolesResource {

    private static final String ORG = "organizationId";

    private final CustomRoles roles;
    private final SecurityIdentity identity;
    private final List<String> clientIdClaims;

    @Inject
    public OrgCustomRolesResource(CustomRoles roles, SecurityIdentity identity,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims) {
        this.roles = roles;
        this.identity = identity;
        this.clientIdClaims = clientIdClaims;
    }

    @GET
    @Operation(operationId = "listCustomRoles",
            summary = "The organization's custom roles, with their permissions and how many principals hold each")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_READ, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId) {
        return IamResponses.ok(() -> roles.list(organizationId));
    }

    @GET
    @Path("/management")
    @Operation(operationId = "customRoleManagementAccess", summary = "Whether the caller manages roles of the root organization")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_READ, permission = OrgPermission.class, params = ORG)
    public Uni<Response> management(@PathParam(ORG) String organizationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.ok(() -> roles.managementAccess(organizationId, caller(devEmail)));
    }

    @POST
    @Operation(operationId = "createCustomRole",
            summary = "Create a custom role from catalog permissions. Owner or Admin only")
    public Uni<Response> create(@PathParam(ORG) String organizationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, RoleRequest body) {
        return IamResponses.respond(() -> roles.create(organizationId, caller(devEmail), body),
                Response.Status.CREATED);
    }

    @PUT
    @Path("/{roleId}")
    @Operation(operationId = "updateCustomRole",
            summary = "Rename a custom role or replace its permissions; its key and bindings stay. Owner or Admin only")
    public Uni<Response> update(@PathParam(ORG) String organizationId, @PathParam("roleId") UUID roleId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, RoleRequest body) {
        return IamResponses.ok(() -> roles.update(organizationId, caller(devEmail), roleId, body));
    }

    @DELETE
    @Path("/{roleId}")
    @Operation(operationId = "deleteCustomRole",
            summary = "Delete a custom role and its bindings; returns how many bindings were removed."
                    + " Owner or Admin only")
    public Uni<Response> delete(@PathParam(ORG) String organizationId, @PathParam("roleId") UUID roleId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.ok(() -> roles.delete(organizationId, caller(devEmail), roleId));
    }

    private Caller caller(String devEmail) {
        return IamIdentityAugmentor.callerOf(identity, devEmail, clientIdClaims);
    }
}
