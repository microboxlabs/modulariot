package com.microboxlabs.miot.integrations.auth.oauth;

import com.microboxlabs.miot.integrations.domain.TokenRequestFormat;
import java.net.URI;
import java.util.Optional;

public record OAuth2ClientCredentialsConfig(
        URI tokenUrl,
        String clientId,
        String clientSecret,
        Optional<String> scope,
        Optional<String> audience,
        TokenRequestFormat tokenRequestFormat) {

    public static OAuth2ClientCredentialsConfig withoutOptionalClaims(
            URI tokenUrl,
            String clientId,
            String clientSecret,
            TokenRequestFormat tokenRequestFormat) {
        return new OAuth2ClientCredentialsConfig(
                tokenUrl,
                clientId,
                clientSecret,
                Optional.empty(),
                Optional.empty(),
                tokenRequestFormat);
    }

    @Override
    public String toString() {
        return "OAuth2ClientCredentialsConfig[tokenUrl=" + tokenUrl
                + ", clientId=" + clientId
                + ", clientSecret=<redacted>"
                + ", scope=" + scope
                + ", audience=" + audience
                + ", tokenRequestFormat=" + tokenRequestFormat
                + "]";
    }
}
