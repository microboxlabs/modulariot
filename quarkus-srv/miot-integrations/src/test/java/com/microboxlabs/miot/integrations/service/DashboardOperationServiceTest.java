package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DashboardOperationServiceTest {
    private static DashboardOperationService.Request request(int rows, int bytes) {
        return new DashboardOperationService.Request("acme", "ops", "summary", "viewer", "connection", "operation",
                Map.of("days", 30), new DashboardOperationService.Limits(rows, bytes));
    }

    private static IntegrationOperation operation(String method) {
        return new IntegrationOperation("operation", "connection", "summary", method, "/summary",
                Map.of("type", "object", "additionalProperties", false,
                        "properties", Map.of("days", Map.of("type", "integer"), "tenant", Map.of("type", "string")),
                        "x-dashboard", Map.of("readOnly", true, "kind", "HTTP_GET", "tenantParameter", "tenant")),
                Map.of(), false);
    }

    @Test
    void executesExactlyTheValidatedSnapshotWithHostTenantBinding() {
        Fixture fixture = new Fixture();
        var result = fixture.service.execute("ACME", request(10, 1000));
        assertEquals(1, result.path("rows").size());
        assertEquals(Map.of("days", "30", "tenant", "ACME"), fixture.invoker.parameters);
        assertSame(fixture.operations.operation, fixture.invoker.operation);
        assertEquals(1, fixture.operations.lookups);
        assertEquals(1, fixture.connections.lookups);
    }

    @Test
    void refusesMissingInactiveAndOtherTenantConnectionsBeforeOperationLookup() {
        for (ConnectionStatus status : ConnectionStatus.values()) {
            if (status == ConnectionStatus.ACTIVE) continue;
            Fixture fixture = new Fixture();
            fixture.connections.status = status;
            refused(fixture, "ACME", request(10, 1000));
            assertEquals(0, fixture.operations.lookups);
        }
        Fixture fixture = new Fixture();
        refused(fixture, "OTHER", request(10, 1000));
        assertEquals(0, fixture.operations.lookups);
        assertEquals(0, fixture.invoker.calls);
    }

    @Test
    void refusesIneligibleOperationsBeforeInvocation() {
        Fixture fixture = new Fixture();
        fixture.operations.operation = operation("POST");
        refused(fixture, "ACME", request(10, 1000));
        fixture.operations.operation = null;
        refused(fixture, "ACME", request(10, 1000));
        assertEquals(0, fixture.invoker.calls);
    }

    @Test
    void enforcesBoundsBeforeLoadingCredentials() {
        for (var request : new DashboardOperationService.Request[]{request(0, 1000), request(5001, 1000),
                request(1, 0), request(1, 2097153), null}) {
            Fixture fixture = new Fixture();
            refused(fixture, "ACME", request);
            assertEquals(0, fixture.connections.lookups);
        }
    }

    @Test
    void rejectsProviderFailuresMalformedRowsAndUnboundedResults() {
        for (String body : new String[]{"bad JSON", "{\"rows\":[]}", "[null]", "[{\"nested\":{}}]",
                "[{\"nested\":[[]]}]", "[{\"a\":1},{\"a\":2}]", "[{\"text\":\"" + "x".repeat(2049) + "\"}]"}) {
            Fixture fixture = new Fixture();
            fixture.invoker.response = new OperationInvocationResult(200, body);
            refused(fixture, "ACME", request(1, 10000));
        }
        Fixture fixture = new Fixture();
        fixture.invoker.response = new OperationInvocationResult(403, "private provider error");
        refused(fixture, "ACME", request(10, 1000));
        fixture.invoker.response = new OperationInvocationResult(200, "[]");
        refused(fixture, "ACME", request(10, 5)); // Include the rows envelope in the bound.
    }

    @Test
    void stripsCausesAndReleasesCapacityAfterFailures() {
        Fixture fixture = new Fixture();
        fixture.invoker.fail = true;
        for (int i = 0; i < 12; i++) {
            var error = refused(fixture, "ACME", request(10, 1000));
            assertNull(error.getCause());
        }
        fixture.invoker.fail = false;
        assertEquals(1, fixture.service.execute("ACME", request(10, 1000)).path("rows").size());
    }

    private static OperationInvocationException refused(Fixture fixture, String tenant, DashboardOperationService.Request request) {
        var error = assertThrows(OperationInvocationException.class, () -> fixture.service.execute(tenant, request));
        assertEquals("Dashboard operation could not be completed", error.getMessage());
        return error;
    }

    private static class Fixture {
        final Connections connections = new Connections();
        final Operations operations = new Operations();
        final Invoker invoker = new Invoker();
        final DashboardOperationService service = new DashboardOperationService(
                new IntegrationConnectionResolver(connections, null, null), operations, invoker);
    }

    private static class Connections extends IntegrationConnectionRepository {
        ConnectionStatus status = ConnectionStatus.ACTIVE;
        int lookups;
        Connections() { super(null); }
        @Override public IntegrationConnection findByTenantAndId(String tenant, String id) {
            lookups++;
            return "ACME".equals(tenant) && "connection".equals(id)
                    ? new IntegrationConnection(id, tenant, "test", ProviderType.CUSTOM_HTTP,
                            URI.create("https://example.com"), null, status, null, null, Map.of()) : null;
        }
    }

    private static class Operations extends IntegrationOperationRepository {
        IntegrationOperation operation = DashboardOperationServiceTest.operation("GET");
        int lookups;
        Operations() { super(null); }
        @Override public IntegrationOperation findByConnectionAndId(String connection, String id) {
            lookups++;
            assertEquals("connection", connection);
            assertEquals("operation", id);
            return operation;
        }
    }

    private static class Invoker extends IntegrationOperationInvoker {
        Map<String, String> parameters;
        IntegrationOperation operation;
        OperationInvocationResult response = new OperationInvocationResult(200, "[{\"count\":3}]");
        int calls;
        boolean fail;
        Invoker() { super(null, null, null, 20); }
        @Override OperationInvocationResult executeBounded(ResolvedConnection connection, IntegrationOperation operation,
                Map<String, String> parameters, int bytes) {
            calls++;
            if (fail) throw new IllegalStateException("private credential details");
            this.parameters = parameters;
            this.operation = operation;
            return response;
        }
    }
}
