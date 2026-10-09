package com.microboxlabs.miot.core.iam;

import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/** What the HTTP authentication mechanism needs from IAM: API key sign-in and the organization permission checker. */
@ApplicationScoped
public class IamAuthentication {

    private final IamIdentityAugmentor iam;
    private final ApiKeyService apiKeys;

    @Inject
    public IamAuthentication(IamIdentityAugmentor iam, ApiKeyService apiKeys) {
        this.iam = iam;
        this.apiKeys = apiKeys;
    }

    /** The service account identity of a valid API key, or null. */
    public Uni<SecurityIdentity> apiKey(String token) {
        return apiKeys.authenticate(token).map(holder -> holder == null
                ? null
                : iam.withOrgPermissions(IamIdentityAugmentor.serviceAccountIdentity(holder), null));
    }

    /** The identity plus the organization permission checker; null stays null. */
    public SecurityIdentity withOrgPermissions(SecurityIdentity identity, String headerEmail) {
        return identity == null ? null : iam.withOrgPermissions(identity, headerEmail);
    }
}
