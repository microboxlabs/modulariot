package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.model.Organization;
import io.smallrye.mutiny.Uni;
import java.time.Instant;

/** Gets an access token from one of an organization's stored credentials. Provided by the integrations module. */
public interface ServiceAccountTokenIssuer {

    record IssuedToken(String accessToken, Instant expiresAt) {
    }

    /**
     * Runs the credential's grant.
     *
     * @throws java.util.NoSuchElementException when the organization has no such credential
     * @throws IllegalStateException when the credential cannot produce a bearer token
     */
    Uni<IssuedToken> issue(Organization organization, String credentialRef);
}
