package com.microboxlabs.miot.core.alfresco.auth;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * HTTP Basic auth against Alfresco. Used for dev, CI and server-to-server
 * calls where no user JWT is available. Reads credentials from
 * {@code miot.alfresco.basic.username} / {@code .password}.
 *
 * <p>Active when {@code miot.alfresco.auth=basic}. In production
 * prefer {@link OAuthBearerAuthProvider}.
 */
@ApplicationScoped
@LookupIfProperty(name = "miot.alfresco.auth", stringValue = "basic")
public class BasicAuthProvider implements AlfrescoAuthProvider {

    private final String headerValue;

    public BasicAuthProvider(
            @ConfigProperty(name = "miot.alfresco.basic.username", defaultValue = "") String username,
            @ConfigProperty(name = "miot.alfresco.basic.password", defaultValue = "") String password) {
        if (username.isBlank() || password.isBlank()) {
            this.headerValue = null;
        } else {
            String token = Base64.getEncoder().encodeToString(
                    (username + ":" + password).getBytes(StandardCharsets.UTF_8));
            this.headerValue = "Basic " + token;
        }
    }

    @Override
    public String resolveAuthHeader() {
        if (headerValue == null) {
            throw new IllegalStateException(
                    "miot.alfresco.auth=basic but miot.alfresco.basic.username/password are not set");
        }
        return headerValue;
    }
}
