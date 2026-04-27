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

    public OAuth2ClientCredentialsConfig {
        scope = scope == null ? Optional.empty() : scope;
        audience = audience == null ? Optional.empty() : audience;
    }
}
