package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DashboardOperationCatalogTest {
    private static final Map<String, Object> SCOPED = Map.of("readOnly", true, "kind", "HTTP_GET", "credentialScoped", true);

    private static IntegrationConnection connection(String id, ConnectionStatus status) {
        return new IntegrationConnection(id, "ACME", "Data " + id, ProviderType.POSTGREST,
                URI.create("https://data.example"), "profile", status, null, true, Map.of());
    }

    private static IntegrationOperation operation(String id, String method, Map<String, Object> settings) {
        return new IntegrationOperation(id, "c", "fn_" + id, method, "/rpc/fn_" + id,
                settings == null ? Map.of("type", "object") : Map.of("type", "object", "additionalProperties", false,
                        "properties", Map.of("p", Map.of("type", "string")), "x-dashboard", settings),
                Map.of(), false);
    }

    @Test
    void listsOnlyActiveConnectionsWithEligibleOperationsByNameAndId() {
        var connections = new IntegrationConnectionRepository(null) {
            @Override public List<IntegrationConnection> listByTenant(String tenant) {
                assertEquals("ACME", tenant);
                return List.of(connection("active", ConnectionStatus.ACTIVE), connection("draft", ConnectionStatus.DRAFT),
                        connection("empty", ConnectionStatus.ACTIVE));
            }
        };
        var operations = new IntegrationOperationRepository(null) {
            @Override public List<IntegrationOperation> listByConnection(String id) {
                if (!id.equals("active")) return List.of(operation("other", "GET", null));
                return List.of(
                        operation("ok", "GET", SCOPED),
                        operation("post", "POST", SCOPED),
                        operation("plain", "GET", null),
                        operation("writable", "GET", Map.of("readOnly", false, "kind", "HTTP_GET", "credentialScoped", true)),
                        operation("unscoped", "GET", Map.of("readOnly", true, "kind", "HTTP_GET")),
                        operation("tenant", "GET", Map.of("readOnly", true, "kind", "HTTP_GET", "tenantParameter", "p")));
            }
        };
        var result = new DashboardOperationCatalog(connections, operations).list("ACME");
        assertEquals(List.of(new DashboardOperationCatalog.Connection("active", "Data active", List.of(
                new DashboardOperationCatalog.Operation("ok", "fn_ok"),
                new DashboardOperationCatalog.Operation("tenant", "fn_tenant")))), result);
        assertFalse(result.toString().contains("/rpc/"));
    }
}
