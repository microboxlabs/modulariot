package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth0.Auth0Management;
import com.microboxlabs.miot.core.gps.GpsAccessCatalog;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.iam.model.IamAuditEvent;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
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
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.function.Function;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * How the organization's GPS provider sends positions: with a token issued for its Auth0 client, or with an API key.
 * Errors: 403, 404, 409 when Auth0 management is not configured or Auth0 refuses.
 */
@Path("/api/v1/orgs/{organizationId}/gps/integration")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.WILDCARD)
@Tag(name = "GPS", description = "How a GPS provider sends positions")
@SecurityRequirement(name = "oidc")
@Authenticated
public class OrgGpsResource {

    private static final String ORG = "organizationId";

    /**
     * {@code tokenUrl} and {@code trackUrl}: the token and position endpoints for the Auth0 client.
     * {@code keyTrackUrl}: the position endpoint that takes an API key, or null when this deployment has none.
     * {@code secretAvailable}: whether the secret can be revealed and rotated here.
     */
    public record IntegrationView(String clientId, String audience, String tokenUrl, String trackUrl,
            String keyTrackUrl, List<String> scopes, boolean secretAvailable) {
    }

    public record SecretView(String clientSecret) {
    }

    private final Auth0Management auth0;
    private final SecurityIdentity identity;
    private final List<String> clientIdClaims;
    private final Optional<String> tokenUrl;
    private final Optional<String> trackUrl;
    private final Optional<String> keyTrackUrl;
    private final List<String> scopes;

    @Inject
    public OrgGpsResource(Auth0Management auth0, SecurityIdentity identity,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims,
            @ConfigProperty(name = "miot.gps.token-url") Optional<String> tokenUrl,
            @ConfigProperty(name = "miot.gps.track-url") Optional<String> trackUrl,
            @ConfigProperty(name = "miot.gps.key-track-url") Optional<String> keyTrackUrl,
            @ConfigProperty(name = "miot.gps.scopes", defaultValue = "asset:track:write") List<String> scopes) {
        this.auth0 = auth0;
        this.identity = identity;
        this.clientIdClaims = clientIdClaims;
        this.tokenUrl = tokenUrl;
        this.trackUrl = trackUrl;
        this.keyTrackUrl = keyTrackUrl;
        this.scopes = scopes;
    }

    @GET
    @Operation(operationId = "getGpsIntegration", summary = "The client id and endpoints the provider uses")
    @PermissionsAllowed(value = GpsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> get(@PathParam(ORG) String organizationId) {
        return IamResponses.ok(() -> organization(organizationId).map(org -> new IntegrationView(
                org.tenantClientId,
                auth0.audience().orElse(null),
                tokenUrl.or(auth0::tokenUrl).orElse(null),
                trackUrl.orElse(null),
                keyTrackUrl.orElse(null),
                scopes,
                auth0.configured())));
    }

    @POST
    @Path("/secret")
    @Operation(operationId = "revealGpsSecret", summary = "The client secret, read from Auth0")
    @PermissionsAllowed(value = GpsAccessCatalog.SECRET_READ, permission = OrgPermission.class, params = ORG)
    public Uni<Response> reveal(@PathParam(ORG) String organizationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return secret(organizationId, devEmail, "gps-secret-read", auth0::secret);
    }

    @POST
    @Path("/secret/rotate")
    @Operation(operationId = "rotateGpsSecret",
            summary = "Replace the client secret. The old secret stops working at once")
    @PermissionsAllowed(value = GpsAccessCatalog.SECRET_ROTATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> rotate(@PathParam(ORG) String organizationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return secret(organizationId, devEmail, "gps-secret-rotate", auth0::rotateSecret);
    }

    /**
     * Records the action, then calls Auth0. A sub-account uses its parent's application, so only the parent's Owners
     * may touch the secret: 409 for a sub-account.
     */
    private Uni<Response> secret(String slug, String devEmail, String action, Function<String, Uni<String>> call) {
        String actor = IamIdentityAugmentor.callerOf(identity, devEmail, clientIdClaims).name();
        return IamResponses.ok(() -> organization(slug).flatMap(org -> {
            if (org.parent != null) {
                throw new IllegalStateException("The secret belongs to the parent organization");
            }
            return Panache.withTransaction(() -> IamAuditEvent
                            .of(org.id, actor, action, org.tenantClientId, Map.of()).persist())
                    .flatMap(ignored -> call.apply(org.tenantClientId))
                    .map(SecretView::new);
        })).map(response -> Response.fromResponse(response).header("Cache-Control", "no-store").build());
    }

    private static Uni<Organization> organization(String slug) {
        return Panache.withSession(() -> Organization.findBySlug(slug)).map(org -> {
            if (org == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            return org;
        });
    }
}
