package com.microboxlabs.miot.integrations.auth.bearer;

import com.microboxlabs.miot.integrations.auth.AuthStrategy;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class BearerTokenStrategy implements AuthStrategy<BearerTokenConfig> {

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.BEARER_TOKEN);
    }

    @Override
    public ResolvedAuth resolve(BearerTokenConfig config) {
        return ResolvedAuth.headers(Map.of("Authorization", "Bearer " + config.token()), null);
    }
}
