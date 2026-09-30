package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PostgrestCatalogTest {
    private static final String SPEC = """
            {"swagger":"2.0","paths":{
              "/":{"get":{}},
              "/vehicles":{"get":{}},
              "/rpc/fn_summary":{"get":{"summary":"Fleet summary","parameters":[
                {"name":"p_client","in":"query","type":"string","format":"text","required":true},
                {"name":"p_days","in":"query","type":"integer","format":"integer"},
                {"$ref":"#/parameters/select"},
                {"name":"Prefer","in":"header","type":"string"}]},
               "post":{}},
              "/rpc/fn_write":{"post":{}}}}
            """;

    private final List<IntegrationOperation> stored = new ArrayList<>();
    private ProviderType provider = ProviderType.POSTGREST;
    private OperationInvocationResult answer = new OperationInvocationResult(200, SPEC);

    private final PostgrestCatalog catalog = new PostgrestCatalog(new Connections(), null, new Operations(), null) {
        @Override
        public OperationInvocationResult fetchSpec(IntegrationConnection connection) {
            return answer;
        }
    };

    @Test
    void listsGetRpcFunctionsWithQueryParametersAndImportState() {
        var functions = catalog.functions("ACME", "c1");
        assertEquals(1, functions.size());
        var function = functions.get(0);
        assertEquals("fn_summary", function.name());
        assertEquals("/rpc/fn_summary", function.path());
        assertEquals("Fleet summary", function.description());
        assertEquals(List.of(
                new PostgrestCatalog.Parameter("p_client", "string", "text", true),
                new PostgrestCatalog.Parameter("p_days", "integer", "integer", false)), function.parameters());
        assertNull(function.operationId());
    }

    @Test
    void importsDashboardEligibleOperationsWithPinnedValuesOnce() {
        var result = catalog.importFunctions("ACME", "c1", new PostgrestCatalog.ImportRequest(List.of(
                new PostgrestCatalog.Selection("fn_summary", Map.of("p_client", "client-1", "select", "id,total")))));
        assertEquals(1, result.created().size());
        IntegrationOperation operation = result.created().get(0);
        assertEquals("GET", operation.method());
        assertEquals("/rpc/fn_summary", operation.path());
        assertTrue(DashboardOperationPolicy.eligible(operation));
        @SuppressWarnings("unchecked")
        var properties = (Map<String, Object>) operation.requestSchema().get("properties");
        assertEquals(Map.of("type", "string", "const", "client-1"), properties.get("p_client"));
        assertEquals(Map.of("type", "string", "const", "id,total"), properties.get("select"));
        assertEquals(Map.of("type", "string", "maxLength", 2048), properties.get("p_days"));
        assertEquals(List.of("p_client", "select"), operation.requestSchema().get("required"));

        var again = catalog.importFunctions("ACME", "c1", new PostgrestCatalog.ImportRequest(List.of(
                new PostgrestCatalog.Selection("fn_summary", null))));
        assertEquals(List.of(), again.created());
        assertEquals(List.of(operation), again.existing());
        assertEquals(operation.id(), catalog.functions("ACME", "c1").get(0).operationId());
    }

    @Test
    void refusesUnknownFunctionsPinsAndNonPostgrestConnections() {
        var postOnly = new PostgrestCatalog.ImportRequest(List.of(new PostgrestCatalog.Selection("fn_write", null)));
        var unknownPin = new PostgrestCatalog.ImportRequest(List.of(
                new PostgrestCatalog.Selection("fn_summary", Map.of("p_other", "x"))));
        var empty = new PostgrestCatalog.ImportRequest(List.of());
        assertThrows(IllegalArgumentException.class, () -> catalog.importFunctions("ACME", "c1", postOnly));
        assertThrows(IllegalArgumentException.class, () -> catalog.importFunctions("ACME", "c1", unknownPin));
        assertThrows(IllegalArgumentException.class, () -> catalog.importFunctions("ACME", "c1", empty));
        assertThrows(ConnectionResolutionException.class, () -> catalog.functions("ACME", "missing"));
        provider = ProviderType.CUSTOM_HTTP;
        assertThrows(IllegalArgumentException.class, () -> catalog.functions("ACME", "c1"));
        assertTrue(stored.isEmpty());
    }

    @Test
    void reportsAnUnusableDescription() {
        answer = new OperationInvocationResult(401, "{}");
        assertThrows(OperationInvocationException.class, () -> catalog.functions("ACME", "c1"));
        answer = new OperationInvocationResult(200, "<html>");
        assertThrows(OperationInvocationException.class, () -> catalog.functions("ACME", "c1"));
        answer = new OperationInvocationResult(200, "{}");
        assertThrows(OperationInvocationException.class, () -> catalog.functions("ACME", "c1"));
    }

    private class Connections extends IntegrationConnectionRepository {
        Connections() { super(null); }
        @Override public IntegrationConnection findByTenantAndId(String tenant, String id) {
            if (!"c1".equals(id)) return null;
            return new IntegrationConnection("c1", tenant, "Data", provider, URI.create("https://data.example"),
                    "profile", ConnectionStatus.ACTIVE, null, true, Map.of());
        }
    }

    private class Operations extends IntegrationOperationRepository {
        Operations() { super(null); }
        @Override public List<IntegrationOperation> listByConnection(String id) { return List.copyOf(stored); }
        @Override public IntegrationOperation create(IntegrationOperation operation) {
            stored.add(operation);
            return operation;
        }
    }
}
