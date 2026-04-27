package com.microboxlabs.miot.integrations.auth.basic;

import com.microboxlabs.miot.integrations.auth.AuthStrategy;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class BasicAuthStrategy implements AuthStrategy<BasicAuthConfig> {

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.BASIC);
    }

    @Override
    public ResolvedAuth resolve(BasicAuthConfig config) {
        String raw = config.username() + ":" + config.password();
        String encoded = Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        return ResolvedAuth.headers(Map.of("Authorization", "Basic " + encoded), null);
    }
}
