package com.microboxlabs.miot.core.alfresco.client;

import com.microboxlabs.miot.core.alfresco.auth.AlfrescoAuthProvider;
import io.quarkus.arc.Arc;
import jakarta.ws.rs.client.ClientRequestContext;
import jakarta.ws.rs.client.ClientRequestFilter;
import jakarta.ws.rs.core.HttpHeaders;

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
            throw new IllegalStateException(
                    "No AlfrescoAuthProvider bean active. "
                            + "Set miot.alfresco.auth to one of: oauth, basic.");
        }
        String header = provider.resolveAuthHeader();
        requestContext.getHeaders().putSingle(HttpHeaders.AUTHORIZATION, header);
    }
}
