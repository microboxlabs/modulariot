package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.iam.TeamsService;
import com.microboxlabs.miot.core.iam.TeamsService.BindingRequest;
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

/** Role bindings: a module role held by a member, team or service account, on the org or a sub-account. */
@Path("/api/v1/orgs/{organizationId}/team/bindings")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Team", description = "Members, their roles, and invitations")
@SecurityRequirement(name = "oidc")
@Authenticated
public class OrgBindingsResource {

    private static final String ORG = "organizationId";

    private final TeamsService teams;
    private final SecurityIdentity identity;
    private final List<String> clientIdClaims;

    @Inject
    public OrgBindingsResource(TeamsService teams, SecurityIdentity identity,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims) {
        this.teams = teams;
        this.identity = identity;
        this.clientIdClaims = clientIdClaims;
    }

    @GET
    @Operation(operationId = "listBindings", summary = "Every role binding of the organization")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_READ, permission = OrgPermission.class, params = ORG)
    public Uni<Response> bindings(@PathParam(ORG) String organizationId) {
        return IamResponses.ok(() -> teams.bindings(organizationId));
    }

    @POST
    @Operation(operationId = "createBinding", summary = "Grant a module role to a member, team or service account,"
            + " on the whole organization or one sub-account (by slug)")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_UPDATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> bind(@PathParam(ORG) String organizationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, BindingRequest body) {
        return IamResponses.respond(() -> teams.bind(organizationId, caller(devEmail), body),
                Response.Status.CREATED);
    }

    @DELETE
    @Path("/{bindingId}")
    @Operation(operationId = "deleteBinding", summary = "Remove a role binding")
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_UPDATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> unbind(@PathParam(ORG) String organizationId, @PathParam("bindingId") UUID bindingId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.respond(() -> teams.unbind(organizationId, caller(devEmail), bindingId),
                Response.Status.NO_CONTENT);
    }

    private Caller caller(String devEmail) {
        return IamIdentityAugmentor.callerOf(identity, devEmail, clientIdClaims);
    }
}
