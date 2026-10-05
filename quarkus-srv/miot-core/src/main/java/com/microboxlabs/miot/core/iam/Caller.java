package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamUser;
import java.util.UUID;

/**
 * Who is asking: a person (email from the token), an M2M client (client id, no email), or a service account (API
 * key, with the organization that owns it). At most one kind is set.
 */
public record Caller(String email, String clientId, UUID serviceAccountId, Long serviceAccountOrganizationId) {

    public Caller {
        email = email == null || email.isBlank() ? null : IamUser.normalize(email);
        clientId = clientId == null || clientId.isBlank() || email != null ? null : clientId.trim();
        if (email != null || clientId != null) {
            serviceAccountId = null;
            serviceAccountOrganizationId = null;
        }
    }

    public Caller(String email, String clientId) {
        this(email, clientId, null, null);
    }

    public static Caller user(String email) {
        return new Caller(email, null);
    }

    public static Caller client(String clientId) {
        return new Caller(null, clientId);
    }

    public static Caller serviceAccount(UUID id, Long organizationId) {
        return new Caller(null, null, id, organizationId);
    }

    public boolean isUser() {
        return email != null;
    }

    public boolean isClient() {
        return clientId != null;
    }

    public boolean isServiceAccount() {
        return serviceAccountId != null;
    }

    /** For audit: the email, client id, or {@code service-account:<id>}. */
    public String name() {
        if (isUser()) {
            return email;
        }
        return isClient() ? clientId : "service-account:" + serviceAccountId;
    }

    /** A stable key for caching a decision within a request. */
    String key() {
        if (isUser()) {
            return "u:" + email;
        }
        return isClient() ? "c:" + clientId : "s:" + serviceAccountId;
    }
}
