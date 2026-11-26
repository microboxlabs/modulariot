package com.microboxlabs.miot.core.api;

import jakarta.ws.rs.HeaderParam;

/**
 * The headers this proxy sends the dashboard server: the shared key, the
 * user, the tenant, scope and role the membership filter resolved, and the
 * teams the caller belongs to there, which dashboards can be shared with.
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

    @HeaderParam(DashboardClient.ASSERTED_GROUPS_HEADER)
    public String groups;

    public DashboardAssertion() {
    }

    public DashboardAssertion(String proxyKey, String user, String tenant,
                              String scope, String role) {
        this(proxyKey, user, tenant, scope, role, null);
    }

    /** {@code groups} is comma-separated; null sends no groups header. */
    public DashboardAssertion(String proxyKey, String user, String tenant,
                              String scope, String role, String groups) {
        this.proxyKey = proxyKey;
        this.user = user;
        this.tenant = tenant;
        this.scope = scope;
        this.role = role;
        this.groups = groups;
    }

    /** No key configured, no web user, or no bearer token to check against. */
    public static DashboardAssertion none() {
        return NONE;
    }
}
