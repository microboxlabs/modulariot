package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.iam.TeamService;
import com.microboxlabs.miot.core.iam.TeamService.BaseRoleRequest;
import com.microboxlabs.miot.core.iam.TeamService.InviteRequest;
import com.microboxlabs.miot.core.iam.TeamService.RolesRequest;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.QueryParam;
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
 * The organization's members and invitations. A sub-account shows its parent's members. Errors: 400 bad input,
 * 403 not allowed (including granting what the caller does not hold), 404 not found, 409 a rule such as keeping one
 * owner.
 */
@Path("/api/v1/orgs/{organizationId}/team")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Team", description = "Members, their roles, and invitations")
@SecurityRequirement(name = "oidc")
@Authenticated
public class OrgTeamResource {

    private static final String ORG = "organizationId";

    private final TeamService team;
    private final SecurityIdentity identity;
    private final List<String> clientIdClaims;

    @Inject
    public OrgTeamResource(TeamService team, SecurityIdentity identity,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims) {
        this.team = team;
        this.identity = identity;
        this.clientIdClaims = clientIdClaims;
    }

    @GET
    @Path("/members")
    @Operation(operationId = "listMembers", summary = "Members with their base role and module roles")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_READ, permission = OrgPermission.class, params = ORG)
    public Uni<Response> members(@PathParam(ORG) String organizationId) {
        return IamResponses.ok(() -> team.members(organizationId));
    }

    @PATCH
    @Path("/members/{userId}")
    @Operation(operationId = "setMemberBaseRole", summary = "Change a member's base role: OWNER, ADMIN or MEMBER")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_UPDATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> setBaseRole(@PathParam(ORG) String organizationId, @PathParam("userId") UUID userId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, BaseRoleRequest body) {
        return IamResponses.ok(() -> team.setBaseRole(organizationId, caller(devEmail), userId, body));
    }

    @PUT
    @Path("/members/{userId}/roles")
    @Operation(operationId = "setMemberRoles", summary = "Replace a member's module roles on the organization")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_UPDATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> setRoles(@PathParam(ORG) String organizationId, @PathParam("userId") UUID userId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, RolesRequest body) {
        return IamResponses.ok(() -> team.setRoles(organizationId, caller(devEmail), userId, body));
    }

    @DELETE
    @Path("/members/{userId}")
    @Operation(operationId = "removeMember", summary = "Remove a member and their roles")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_REMOVE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> remove(@PathParam(ORG) String organizationId, @PathParam("userId") UUID userId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.respond(() -> team.remove(organizationId, caller(devEmail), userId),
                Response.Status.NO_CONTENT);
    }

    @GET
    @Path("/invitations")
    @Operation(operationId = "listInvitations", summary = "Pending invitations, expired ones included")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_READ, permission = OrgPermission.class, params = ORG)
    public Uni<Response> invitations(@PathParam(ORG) String organizationId) {
        return IamResponses.ok(() -> team.invitations(organizationId));
    }

    @POST
    @Path("/invitations")
    @Operation(operationId = "inviteMembers", summary = "Invite emails with a base role and module roles. Each result"
            + " carries its token once; the app builds the link from it. Re-inviting a pending email renews it")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_INVITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> invite(@PathParam(ORG) String organizationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, InviteRequest body) {
        return IamResponses.respond(() -> team.invite(organizationId, caller(devEmail), body),
                Response.Status.CREATED);
    }

    @POST
    @Path("/invitations/{invitationId}/resend")
    @Consumes(MediaType.WILDCARD)
    @Operation(operationId = "resendInvitation", summary = "A new token and expiry for a pending invitation")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_INVITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> resend(@PathParam(ORG) String organizationId,
            @PathParam("invitationId") UUID invitationId, @QueryParam("lang") String lang,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.ok(() -> team.resend(organizationId, caller(devEmail), invitationId, lang));
    }

    @DELETE
    @Path("/invitations/{invitationId}")
    @Operation(operationId = "revokeInvitation", summary = "Revoke a pending invitation")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_INVITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> revoke(@PathParam(ORG) String organizationId,
            @PathParam("invitationId") UUID invitationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.respond(() -> team.revoke(organizationId, caller(devEmail), invitationId),
                Response.Status.NO_CONTENT);
    }

    private Caller caller(String devEmail) {
        return IamIdentityAugmentor.callerOf(identity, devEmail, clientIdClaims);
    }
}
