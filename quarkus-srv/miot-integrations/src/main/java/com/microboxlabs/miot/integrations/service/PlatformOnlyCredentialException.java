package com.microboxlabs.miot.integrations.service;

/** An organization tried to create a credential for a provider only the platform uses. */
public class PlatformOnlyCredentialException extends IllegalArgumentException {

    public PlatformOnlyCredentialException(String provider) {
        super(provider + " credentials belong to the platform's geocoding connection. Organizations geocode"
                + " through the connection the platform manages for them.");
    }
}
