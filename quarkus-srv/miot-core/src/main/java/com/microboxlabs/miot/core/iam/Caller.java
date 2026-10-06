package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamUser;

/**
 * Who is asking: a person (email from the token) or an M2M client (client id, no email). Exactly one is set, or
 * neither for a caller the modulith cannot identify.
 */
public record Caller(String email, String clientId) {

    public Caller {
        email = email == null || email.isBlank() ? null : IamUser.normalize(email);
        clientId = clientId == null || clientId.isBlank() || email != null ? null : clientId.trim();
    }

    public static Caller user(String email) {
        return new Caller(email, null);
    }

    public static Caller client(String clientId) {
        return new Caller(null, clientId);
    }

    public boolean isUser() {
        return email != null;
    }

    public boolean isClient() {
        return clientId != null;
    }

    /** A stable key for caching a decision within a request. */
    String key() {
        return isUser() ? "u:" + email : "c:" + clientId;
    }
}
