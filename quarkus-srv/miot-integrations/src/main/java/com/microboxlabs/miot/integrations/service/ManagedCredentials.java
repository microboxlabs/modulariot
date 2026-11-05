package com.microboxlabs.miot.integrations.service;

import java.util.Map;

/**
 * A credential managed by the platform: {@code managed: true} in its public half and no secret. Only the platform
 * creates one ({@link CredentialProfileService#createManaged}); the generic credential API refuses to create, edit
 * or test it.
 */
public final class ManagedCredentials {

    public static final String MANAGED = "managed";

    private ManagedCredentials() {
    }

    public static boolean isManaged(Map<String, Object> publicConfig) {
        Object value = publicConfig == null ? null : publicConfig.get(MANAGED);
        return Boolean.TRUE.equals(value) || "true".equals(String.valueOf(value));
    }
}
