package com.microboxlabs.miot.integrations.auth;

import com.microboxlabs.miot.integrations.domain.AuthType;
import java.util.Set;

public interface AuthStrategy<TConfig> {

    Set<AuthType> supportedTypes();

    ResolvedAuth resolve(TConfig config);
}
