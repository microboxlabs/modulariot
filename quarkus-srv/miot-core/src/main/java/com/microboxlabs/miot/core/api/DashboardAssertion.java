package com.microboxlabs.miot.core.api;

import jakarta.ws.rs.HeaderParam;

/**
 * What this proxy tells the dashboard server about a caller it has already
 * checked: the shared key, the user, and the tenant, scope and role the
 * membership filter resolved.
 *
 * <p>One {@code @BeanParam} rather than five parameters on every route. The
 * upstream compares the asserted tenant and scope against the ones it parses
 * out of the path, so both travel here even though both are also in the URL:
 * a rewritten path is then refused instead of being served with whatever role
 * was asserted.
 *
 * <p>{@link #none()} leaves every field null and a null header parameter is
 * not sent, so the five headers are absent together.
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
