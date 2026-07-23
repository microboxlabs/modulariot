package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.auth.oauth.OAuth2ClientCredentialsStrategy;
import com.microboxlabs.miot.integrations.auth.oauth.OAuth2CredentialConfigs;
import com.microboxlabs.miot.integrations.auth.oauth.OAuth2TokenException;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Map;
import org.jboss.logging.Logger;

/**
 * Exercises a client-credentials credential by asking for a token and discarding it.
 * Covers both OAuth types — Azure Entra differs from a generic provider only in where
 * the token endpoint comes from, which {@link OAuth2CredentialConfigs} already resolves.
 *
 * <p>The SSRF check on the token endpoint is the caller's: it is policy about which
 * hosts this deployment may reach, not part of speaking OAuth.
 */
@ApplicationScoped
public class OAuth2CredentialTester implements CredentialTester {

    private static final Logger LOG = Logger.getLogger(OAuth2CredentialTester.class);

    private final OAuth2ClientCredentialsStrategy strategy;

    @Inject
    public OAuth2CredentialTester(OAuth2ClientCredentialsStrategy strategy) {
        this.strategy = strategy;
    }

    @Override
    public boolean supports(CredentialType type) {
        return OAuth2CredentialConfigs.supports(type);
    }

    @Override
    public CredentialTestResponse test(
            CredentialType type,
            Map<String, Object> publicConfig,
            Map<String, Object> secretConfig) {
        try {
            ResolvedAuth auth = strategy.resolve(
                    OAuth2CredentialConfigs.toConfig(type, publicConfig, secretConfig));
            return new CredentialTestResponse(
                    true, OffsetDateTime.now(), "Token issued", secondsUntil(auth.expiresAt()));
        } catch (IllegalArgumentException e) {
            // Incomplete config — the operator's own input, safe to repeat verbatim.
            return CredentialTestResponse.failure(e.getMessage());
        } catch (OAuth2TokenException e) {
            return CredentialTestResponse.failure(
                    e.errorCode() == null
                            ? "The provider rejected the credential (HTTP " + e.statusCode() + ")"
                            : e.errorCode() + " (HTTP " + e.statusCode() + ")");
        } catch (AuthResolutionException e) {
            // Never reached the provider, or its answer made no sense. The cause can
            // carry host detail, so it is logged rather than returned.
            LOG.debugf(e, "Credential test could not complete for a %s credential", type);
            return CredentialTestResponse.failure("Could not reach the token endpoint");
        }
    }

    private Long secondsUntil(Instant expiresAt) {
        if (expiresAt == null) {
            return null;
        }
        long seconds = Duration.between(Instant.now(), expiresAt).toSeconds();
        return seconds > 0 ? seconds : null;
    }
}
