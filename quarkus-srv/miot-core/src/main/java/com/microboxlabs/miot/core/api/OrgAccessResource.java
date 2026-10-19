package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
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

    /** {@code baseRole} is null when the caller is not a member. */
    public record AccessDto(String organization, String baseRole, Set<String> roles, Set<String> permissions) {
    }

    private final AccessEvaluator evaluator;
    private final SecurityIdentity identity;
    private final List<String> clientIdClaims;

    @Inject
    public OrgAccessResource(AccessEvaluator evaluator, SecurityIdentity identity,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims) {
        this.evaluator = evaluator;
        this.identity = identity;
        this.clientIdClaims = clientIdClaims;
    }

    @GET
    @Operation(operationId = "getMyAccess",
            summary = "The caller's base role, module roles and permissions in the organization")
    public Uni<AccessDto> me(@PathParam("organizationId") String organizationId,
            @HeaderParam("X-Dev-User-Email") String devEmail) {
        return evaluator.evaluate(organizationId, IamIdentityAugmentor.callerOf(identity, devEmail, clientIdClaims))
                .map(access -> new AccessDto(organizationId,
                        access.member() ? access.baseRole().name() : null, access.roles(), access.permissions()));
    }
}
