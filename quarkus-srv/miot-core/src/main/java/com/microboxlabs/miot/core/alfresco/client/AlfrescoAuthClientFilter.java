package com.microboxlabs.miot.core.alfresco.client;

import com.microboxlabs.miot.core.alfresco.auth.AlfrescoAuthProvider;
import io.quarkus.arc.Arc;
import io.quarkus.security.credential.TokenCredential;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.ws.rs.client.ClientRequestContext;
import jakarta.ws.rs.client.ClientRequestFilter;
import jakarta.ws.rs.core.HttpHeaders;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * JAX-RS client filter that injects the active {@link AlfrescoAuthProvider}
 * header on every outgoing Alfresco REST call. Registered via
 * {@code @RegisterProvider} on each Alfresco REST client interface.
 *
 * <p>Provider lookup is done at request time via {@link Arc#container()}
 * rather than {@code @Inject} so this filter works whether it's
 * instantiated by CDI or by the REST client's provider factory.
 *
 * <p>Resolves the auth header synchronously by joining on the provider's
 * {@code Uni}. This is acceptable because providers return immediately
 * (they don't perform I/O — the ticket provider caches, and the OAuth
 * provider just reads the current request's JWT).
 */
public class AlfrescoAuthClientFilter implements ClientRequestFilter {

    @Override
    public void filter(ClientRequestContext requestContext) {
        AlfrescoAuthProvider provider = Arc.container()
                .instance(AlfrescoAuthProvider.class)
                .get();
        if (provider == null) {
            requestContext.getHeaders().putSingle(HttpHeaders.AUTHORIZATION, resolveAuthHeaderFromConfig());
            return;
        }
        String header = provider.resolveAuthHeader();
        requestContext.getHeaders().putSingle(HttpHeaders.AUTHORIZATION, header);
    }

    private String resolveAuthHeaderFromConfig() {
        var config = ConfigProvider.getConfig();
        String mode = config.getOptionalValue("miot.alfresco.auth", String.class)
                .orElse("stub");
        return switch (mode) {
            case "stub" -> resolveStubHeader();
            case "oauth" -> resolveOAuthHeader();
            case "basic" -> resolveBasicHeader();
            default -> throw new IllegalStateException(
                    "No AlfrescoAuthProvider bean active for miot.alfresco.auth="
                            + mode + ". Set miot.alfresco.auth to one of: stub, oauth, basic.");
        };
    }

    private String resolveStubHeader() {
        return "Bearer stub";
    }

    private String resolveOAuthHeader() {
        SecurityIdentity identity = Arc.container()
                .instance(SecurityIdentity.class)
                .get();
        if (identity == null || identity.isAnonymous()) {
            throw new IllegalStateException(
                    "Cannot forward JWT to Alfresco: request is anonymous");
        }
        TokenCredential credential = identity.getCredential(TokenCredential.class);
        if (credential != null && credential.getToken() != null
                && !credential.getToken().isBlank()) {
            return "Bearer " + credential.getToken();
        }
        if (identity.getPrincipal() instanceof JsonWebToken jwt) {
            String raw = jwt.getRawToken();
            if (raw != null && !raw.isBlank()) {
                return "Bearer " + raw;
            }
        }
        throw new IllegalStateException(
                "Cannot forward JWT to Alfresco: principal is not a JsonWebToken");
    }

    private String resolveBasicHeader() {
        var config = ConfigProvider.getConfig();
        String username = config.getOptionalValue(
                "miot.alfresco.basic.username", String.class).orElse("");
        String password = config.getOptionalValue(
                "miot.alfresco.basic.password", String.class).orElse("");
        if (username.isBlank() || password.isBlank()) {
            throw new IllegalStateException(
                    "miot.alfresco.auth=basic but miot.alfresco.basic.username/password are not set");
        }
        String token = Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
        return "Basic " + token;
    }
}
