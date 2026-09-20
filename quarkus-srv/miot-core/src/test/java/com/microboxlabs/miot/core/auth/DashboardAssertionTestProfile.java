package com.microboxlabs.miot.core.auth;

import java.util.HashMap;
import java.util.Map;

/**
 * {@link DashboardProxyTestProfile} with a proxy key configured, so the
 * dashboard proxy sends the role it resolved instead of leaving the upstream
 * to look it up.
 *
 * <p>A separate profile rather than a config override on the existing one:
 * the absence of these headers when no key is set is itself a property worth
 * testing, and one profile cannot cover both.
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
