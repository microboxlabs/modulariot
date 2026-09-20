package com.microboxlabs.miot.core.auth;

import java.util.HashMap;
import java.util.Map;

/**
 * {@link DashboardProxyTestProfile} with a proxy key configured, so the
 * dashboard proxy sends the role it resolved instead of leaving the upstream
 * to look it up.
 *
 * <p>A separate profile rather than a config override on the existing one.
 * {@code DashboardProxyResourceTest} checks that no headers are sent without
 * a key, and one profile cannot cover both cases.
 */
public class DashboardAssertionTestProfile extends DashboardProxyTestProfile {

    /** Matches the 32-character floor the dashboard server enforces. */
    public static final String PROXY_KEY = "test-proxy-key-0123456789abcdefg";

    @Override
    public Map<String, String> getConfigOverrides() {
        Map<String, String> overrides = new HashMap<>(super.getConfigOverrides());
        overrides.put("miot.dashboards.proxy-key", PROXY_KEY);
        return overrides;
    }
}
