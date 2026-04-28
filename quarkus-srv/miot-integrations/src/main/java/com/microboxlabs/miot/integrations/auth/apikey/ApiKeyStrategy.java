package com.microboxlabs.miot.integrations.auth.apikey;

import com.microboxlabs.miot.integrations.auth.AuthStrategy;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.ApiKeyPlacement;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class ApiKeyStrategy implements AuthStrategy<ApiKeyConfig> {

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.API_KEY_HEADER, AuthType.API_KEY_QUERY);
    }

    @Override
    public ResolvedAuth resolve(ApiKeyConfig config) {
        if (config.placement() == ApiKeyPlacement.QUERY) {
            return new ResolvedAuth(Map.of(), Map.of(config.name(), config.value()), null);
        }
        if (config.placement() == ApiKeyPlacement.HEADER) {
            return new ResolvedAuth(Map.of(config.name(), config.value()), Map.of(), null);
        }
        throw new IllegalArgumentException(
                "Unsupported API key placement for credential '" + config.name() + "': " + config.placement());
    }
}
