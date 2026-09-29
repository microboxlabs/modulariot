package com.microboxlabs.miot.core.api;

import jakarta.ws.rs.HeaderParam;

/**
 * The five headers this proxy sends the dashboard server: the shared key, the
 * user, and the tenant, scope and role the membership filter resolved.
 *
 * <p>Tenant and scope travel here as well as in the path because the upstream
 * compares the two. A rewritten path is then refused rather than served with
 * the asserted role.
 *
 * <p>{@link #none()} leaves every field null, and a null header parameter is
 * not sent.
 */
public class DashboardAssertion {

    private static final DashboardAssertion NONE = new DashboardAssertion();

    @HeaderParam(DashboardClient.PROXY_KEY_HEADER)
    public String proxyKey;

    @HeaderParam(DashboardClient.ASSERTED_USER_HEADER)
    public String user;

    @HeaderParam(DashboardClient.ASSERTED_TENANT_HEADER)
    public String tenant;

    @HeaderParam(DashboardClient.ASSERTED_SCOPE_HEADER)
    public String scope;

    @HeaderParam(DashboardClient.ASSERTED_ROLE_HEADER)
    public String role;

    public DashboardAssertion() {
    }

    public DashboardAssertion(String proxyKey, String user, String tenant,
                              String scope, String role) {
        this.proxyKey = proxyKey;
        this.user = user;
        this.tenant = tenant;
        this.scope = scope;
        this.role = role;
    }

    /** No key configured, no web user, or no bearer token to check against. */
    public static DashboardAssertion none() {
        return NONE;
    }
}
