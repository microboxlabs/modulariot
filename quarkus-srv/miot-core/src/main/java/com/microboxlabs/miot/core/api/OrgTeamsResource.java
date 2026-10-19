package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.iam.TeamsService;
import com.microboxlabs.miot.core.iam.TeamsService.TeamMembersRequest;
import com.microboxlabs.miot.core.iam.TeamsService.TeamRequest;
import com.microboxlabs.miot.core.iam.TeamsService.TeamRolesRequest;
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
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Teams of the organization: groups of members that role bindings can name. */
@Path("/api/v1/orgs/{organizationId}/team/teams")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Team", description = "Members, their roles, and invitations")
@SecurityRequirement(name = "oidc")
@Authenticated
public class OrgTeamsResource {

    private static final String ORG = "organizationId";

    private final TeamsService teams;
    private final SecurityIdentity identity;
    private final List<String> clientIdClaims;

    @Inject
    public OrgTeamsResource(TeamsService teams, SecurityIdentity identity,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims) {
        this.teams = teams;
        this.identity = identity;
        this.clientIdClaims = clientIdClaims;
    }

    @GET
    @Operation(operationId = "listTeams", summary = "Teams with their members and roles")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_READ, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId) {
        return IamResponses.ok(() -> teams.teams(organizationId));
    }

    @POST
    @Operation(operationId = "createTeam", summary = "Create a team")
    @PermissionsAllowed(value = CoreAccessCatalog.TEAMS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> create(@PathParam(ORG) String organizationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, TeamRequest body) {
        return IamResponses.respond(() -> teams.create(organizationId, caller(devEmail), body),
                Response.Status.CREATED);
    }

    @PATCH
    @Path("/{teamId}")
    @Operation(operationId = "updateTeam", summary = "Rename a team or change its description")
    @PermissionsAllowed(value = CoreAccessCatalog.TEAMS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> update(@PathParam(ORG) String organizationId, @PathParam("teamId") UUID teamId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, TeamRequest body) {
        return IamResponses.ok(() -> teams.update(organizationId, caller(devEmail), teamId, body));
    }

    @DELETE
    @Path("/{teamId}")
    @Operation(operationId = "deleteTeam", summary = "Delete a team and its role bindings")
    @PermissionsAllowed(value = CoreAccessCatalog.TEAMS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> delete(@PathParam(ORG) String organizationId, @PathParam("teamId") UUID teamId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.respond(() -> teams.delete(organizationId, caller(devEmail), teamId),
                Response.Status.NO_CONTENT);
    }

    @PUT
    @Path("/{teamId}/roles")
    @Operation(operationId = "setTeamRoles", summary = "Replace a team's organization-wide roles")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_UPDATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> setRoles(@PathParam(ORG) String organizationId, @PathParam("teamId") UUID teamId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, TeamRolesRequest body) {
        return IamResponses.ok(() -> teams.setRoles(organizationId, caller(devEmail), teamId, body));
    }

    @PUT
    @Path("/{teamId}/members")
    @Operation(operationId = "setTeamMembers", summary = "Replace a team's members; each must be an org member")
    @PermissionsAllowed(value = CoreAccessCatalog.TEAMS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> setMembers(@PathParam(ORG) String organizationId, @PathParam("teamId") UUID teamId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, TeamMembersRequest body) {
        return IamResponses.ok(() -> teams.setMembers(organizationId, caller(devEmail), teamId, body));
    }

    private Caller caller(String devEmail) {
        return IamIdentityAugmentor.callerOf(identity, devEmail, clientIdClaims);
    }
}
