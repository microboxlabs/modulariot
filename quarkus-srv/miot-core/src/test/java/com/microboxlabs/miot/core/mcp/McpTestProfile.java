package com.microboxlabs.miot.core.mcp;

import com.microboxlabs.miot.core.auth.HarnessProxyTestProfile;
import java.util.Map;

/** The auth chain of {@link HarnessProxyTestProfile}, with MCP where the app serves it. */
public class McpTestProfile extends HarnessProxyTestProfile {

    static final String MCP_PATH = "/api/v1/mcp";

    @Override
    public Map<String, String> getConfigOverrides() {
        Map<String, String> overrides = super.getConfigOverrides();
        overrides.put("quarkus.mcp.server.http.root-path", MCP_PATH);
        overrides.put("quarkus.mcp.server.tools.structured-content.compatibility-mode", "true");
        return overrides;
    }
}
