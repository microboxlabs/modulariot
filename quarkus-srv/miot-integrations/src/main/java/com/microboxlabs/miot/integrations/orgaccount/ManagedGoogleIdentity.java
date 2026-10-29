package com.microboxlabs.miot.integrations.orgaccount;

import java.time.Instant;
import java.util.Map;

/**
 * A Google credential managed by the platform: {@code GOOGLE_SERVICE_ACCOUNT} with
 * {@code managed: true} in its public half and no secret. It stands for the
 * organization's own service account, which the platform impersonates.
 */
public interface ManagedGoogleIdentity {

    String MANAGED = "managed";
    String CLIENT_EMAIL = "clientEmail";

    record Token(String value, Instant expiresAt) {
    }

    class UnavailableException extends RuntimeException {
        public UnavailableException(String message) {
            super(message);
        }
    }

    static boolean isManaged(Map<String, Object> publicConfig) {
        Object value = publicConfig == null ? null : publicConfig.get(MANAGED);
        return Boolean.TRUE.equals(value) || "true".equals(String.valueOf(value));
    }

    /** The public half with {@code clientEmail} set to the tenant's own account, whatever it said before. */
    Map<String, Object> bind(String tenantCode, Map<String, Object> publicConfig);

    /** A token for an organization's account; refused for any other account. */
    Token accessToken(String email, String scope);

    /** For callers built without the platform's identity: managed credentials do not resolve. */
    ManagedGoogleIdentity NONE = new ManagedGoogleIdentity() {
        @Override
        public Map<String, Object> bind(String tenantCode, Map<String, Object> publicConfig) {
            throw new UnavailableException("Managed Google credentials are not available here");
        }

        @Override
        public Token accessToken(String email, String scope) {
            throw new UnavailableException("Managed Google credentials are not available here");
        }
    };
}
