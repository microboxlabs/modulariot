package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.auth.google.GoogleServiceAccountConfigs;
import com.microboxlabs.miot.integrations.auth.google.GoogleServiceAccountStrategy;
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

/** Exercises a Google service account by asking for a token and discarding it. */
@ApplicationScoped
public class GoogleServiceAccountCredentialTester implements CredentialTester {

    private static final Logger LOG = Logger.getLogger(GoogleServiceAccountCredentialTester.class);

    private final GoogleServiceAccountStrategy strategy;

    @Inject
    public GoogleServiceAccountCredentialTester(GoogleServiceAccountStrategy strategy) {
        this.strategy = strategy;
    }

    @Override
    public boolean supports(CredentialType type) {
        return GoogleServiceAccountConfigs.supports(type);
    }

    @Override
    public CredentialTestResponse test(
            CredentialType type,
            Map<String, Object> publicConfig,
            Map<String, Object> secretConfig) {
        try {
            ResolvedAuth auth = strategy.resolve(
                    GoogleServiceAccountConfigs.toConfig(publicConfig, secretConfig));
            return new CredentialTestResponse(
                    true, OffsetDateTime.now(), "Token issued", secondsUntil(auth.expiresAt()));
        } catch (IllegalArgumentException e) {
            return CredentialTestResponse.failure(e.getMessage());
        } catch (OAuth2TokenException e) {
            return CredentialTestResponse.failure(
                    e.errorCode() == null
                            ? "Google rejected the service account (HTTP " + e.statusCode() + ")"
                            : e.errorCode() + " (HTTP " + e.statusCode() + ")");
        } catch (AuthResolutionException e) {
            LOG.debugf(e, "Credential test could not complete for a %s credential", type);
            return CredentialTestResponse.failure(e.getMessage());
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
