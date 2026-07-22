package com.microboxlabs.miot.core.alfresco.auth;

import io.quarkus.arc.Unremovable;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;
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
@Unremovable
@LookupIfProperty(name = "miot.alfresco.auth", stringValue = "basic")
public class BasicAuthProvider implements AlfrescoAuthProvider {

    private final String headerValue;

    public BasicAuthProvider(
            @ConfigProperty(name = "miot.alfresco.basic.username") Optional<String> configuredUsername,
            @ConfigProperty(name = "miot.alfresco.basic.password") Optional<String> configuredPassword) {
        String username = configuredUsername.orElse("");
        String password = configuredPassword.orElse("");
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
