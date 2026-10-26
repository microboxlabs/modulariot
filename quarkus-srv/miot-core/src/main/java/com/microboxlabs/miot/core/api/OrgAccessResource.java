package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.TeamsService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** What the caller may do in an organization. */
@Path("/api/v1/orgs/{organizationId}/me/access")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Access", description = "The caller's access and the permission catalog")
@SecurityRequirement(name = "oidc")
@Authenticated
public class OrgAccessResource {

    /** {@code baseRole} is null when the caller is not a member; {@code teams} are the org's teams it belongs to. */
    public record AccessDto(String organization, String baseRole, Set<String> roles, Set<String> permissions,
            List<TeamsService.TeamRef> teams) {
    }

    private final AccessEvaluator evaluator;
    private final TeamsService teams;
    private final SecurityIdentity identity;
    private final List<String> clientIdClaims;

    @Inject
    public OrgAccessResource(AccessEvaluator evaluator, TeamsService teams, SecurityIdentity identity,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims) {
        this.evaluator = evaluator;
        this.teams = teams;
        this.identity = identity;
        this.clientIdClaims = clientIdClaims;
    }

    @GET
    @Operation(operationId = "getMyAccess",
            summary = "The caller's base role, module roles and permissions in the organization")
    public Uni<AccessDto> me(@PathParam("organizationId") String organizationId,
            @HeaderParam("X-Dev-User-Email") String devEmail) {
        Caller caller = IamIdentityAugmentor.callerOf(identity, devEmail, clientIdClaims);
        return evaluator.evaluate(organizationId, caller)
                .flatMap(access -> (access.member() && !PlatformScope.isPlatform(organizationId)
                        ? teams.teamsOf(organizationId, caller)
                        : Uni.createFrom().item(List.<TeamsService.TeamRef>of()))
                        .map(mine -> new AccessDto(organizationId,
                                access.member() ? access.baseRole().name() : null, access.roles(),
                                access.permissions(), mine)));
    }
}
