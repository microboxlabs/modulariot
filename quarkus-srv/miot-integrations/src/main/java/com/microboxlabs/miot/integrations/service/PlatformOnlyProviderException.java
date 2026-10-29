package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ProviderType;

/** An organization tried to create or change a connection of a provider type that only the platform holds. */
public class PlatformOnlyProviderException extends IllegalArgumentException {

    public PlatformOnlyProviderException(ProviderType providerType) {
        super(providerType + " connections are managed by the platform. Organizations use the platform's provider"
                + " within their plan.");
    }
}
