package com.microboxlabs.miot.integrations.auth.google;

import java.net.URI;

/**
 * What a service-account grant needs. {@code privateKeyPem} is the secret; {@link #toString()}
 * leaves it out.
 */
public record GoogleServiceAccountConfig(
        String clientEmail,
        String privateKeyPem,
        String scope,
        URI tokenUrl) {

    @Override
    public String toString() {
        return "GoogleServiceAccountConfig[clientEmail=" + clientEmail
                + ", privateKeyPem=<redacted>"
                + ", scope=" + scope
                + ", tokenUrl=" + tokenUrl
                + "]";
    }
}
