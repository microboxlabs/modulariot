package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ProviderType;

/** An organization tried to create, change, test or delete a connection of a provider type the platform manages. */
public class PlatformOnlyProviderException extends IllegalArgumentException {

    public PlatformOnlyProviderException(ProviderType providerType) {
        super(providerType + " connections are managed by the platform. A platform owner connects an organization"
                + " to the platform's provider.");
    }
}
