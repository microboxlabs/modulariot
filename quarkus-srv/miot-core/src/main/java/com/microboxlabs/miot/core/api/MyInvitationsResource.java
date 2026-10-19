package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.TeamService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
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
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The signed-in person's invitations: listed by their email, accepted by link (token) or from the list. The email of
 * the token must be the invited one.
 */
@Path("/api/v1/me/invitations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Team", description = "Members, their roles, and invitations")
@SecurityRequirement(name = "oidc")
@Authenticated
public class MyInvitationsResource {

    public record AcceptRequest(String token) {
    }

    private final TeamService team;
    private final SecurityIdentity identity;

    @Inject
    public MyInvitationsResource(TeamService team, SecurityIdentity identity) {
        this.team = team;
        this.identity = identity;
    }

    @GET
    @Operation(operationId = "listMyInvitations", summary = "Open invitations for the signed-in email")
    public Uni<Response> list(@HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        String email = email(devEmail);
        if (email == null) {
            return Uni.createFrom().item(Response.ok(List.of()).build());
        }
        return IamResponses.ok(() -> team.mine(email));
    }

    @POST
    @Path("/accept")
    @Operation(operationId = "acceptInvitationByToken", summary = "Accept the invitation the link carries")
    public Uni<Response> acceptToken(@HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail,
            AcceptRequest body) {
        return IamResponses.ok(() -> team.acceptToken(body == null ? null : body.token(), email(devEmail),
                subject(), name()));
    }

    @POST
    @Path("/{invitationId}/accept")
    @Consumes(MediaType.WILDCARD)
    @Operation(operationId = "acceptMyInvitation", summary = "Accept one of the signed-in email's invitations")
    public Uni<Response> accept(@PathParam("invitationId") UUID invitationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.ok(() -> team.acceptMine(invitationId, email(devEmail), subject(), name()));
    }

    private String email(String devEmail) {
        String email = OrganizationAccess.email(identity);
        return email != null ? email : devEmail;
    }

    private String subject() {
        return identity.getPrincipal() instanceof JsonWebToken jwt ? jwt.getSubject() : null;
    }

    private String name() {
        return identity.getPrincipal() instanceof JsonWebToken jwt ? jwt.getClaim("name") : null;
    }
}
