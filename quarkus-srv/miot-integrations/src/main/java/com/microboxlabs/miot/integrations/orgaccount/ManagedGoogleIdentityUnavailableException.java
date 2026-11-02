package com.microboxlabs.miot.integrations.orgaccount;

/** A managed identity cannot currently be bound or used for token issuance. */
public class ManagedGoogleIdentityUnavailableException extends RuntimeException {
    public ManagedGoogleIdentityUnavailableException(String message) {
        super(message);
    }
}
