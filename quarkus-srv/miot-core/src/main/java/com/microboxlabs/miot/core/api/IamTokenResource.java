package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.TokenExchange;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Trades an API key ({@code Authorization: Bearer miot_sk_...}) for the access token of the credential linked to
 * its service account. Used by services that accept only OAuth tokens, such as the GPS publisher.
 */
@Path("/api/v1/iam/token")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Team", description = "Members, their roles, and invitations")
@Authenticated
public class IamTokenResource {

    public record TokenResponse(String access_token, String token_type, long expires_in) {
    }

    private final TokenExchange tokens;
    private final SecurityIdentity identity;

    @Inject
    public IamTokenResource(TokenExchange tokens, SecurityIdentity identity) {
        this.tokens = tokens;
        this.identity = identity;
    }

    @POST
    @Consumes(MediaType.WILDCARD)
    @Operation(operationId = "exchangeApiKey",
            summary = "Exchange an API key for the access token of its service account's linked credential")
    public Uni<Response> exchange() {
        return IamResponses.ok(() -> tokens.exchange(IamIdentityAugmentor.serviceAccountOf(identity))
                        .map(token -> new TokenResponse(token.accessToken(), "Bearer",
                                Math.max(0, Duration.between(Instant.now(), token.expiresAt()).toSeconds()))))
                .map(response -> Response.fromResponse(response).header("Cache-Control", "no-store").build());
    }
}
