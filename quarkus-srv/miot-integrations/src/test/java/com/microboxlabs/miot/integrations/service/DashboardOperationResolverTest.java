package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.*;

import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import java.util.List;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DashboardOperationResolverTest {
    private final Connections connections = new Connections();
    private final Operations operations = new Operations();
    private final Credentials credentials = new Credentials();
    private final DashboardOperationResolver resolver = new DashboardOperationResolver(connections, operations, credentials, 1000);
    private static final DashboardOperationService.Request REQUEST = new DashboardOperationService.Request(
            "acme", "ops", "summary", "viewer", "connection", "operation", Map.of("days", 14),
            new DashboardOperationService.Limits(100, 10000));

    private void setup(String kind, Map<String, Object> settings, ResolvedConnection connection) {
        connections.value = connection;
        operations.value = new IntegrationOperation(
                "operation", "connection", "summary", kind.equals("BIGQUERY") ? "POST" : "GET", "/rpc/summary",
                Map.of("type", "object", "additionalProperties", false,
                        "properties", Map.of("days", Map.of("type", "integer"), "tenant", Map.of("type", "string")),
                        "x-dashboard", settings), Map.of(), false);
    }
    private ResolvedConnection connection(String url, AuthType auth) {
        return new ResolvedConnection("connection", URI.create(url), Map.of(), Map.of("privateKey", "never-return-this"),
                auth, null, Map.of());
    }
    @Test void resolvesHttpWithoutExecutingOrReturningRawSecrets() {
        setup("HTTP_GET", Map.of("kind", "HTTP_GET", "readOnly", true, "tenantParameter", "tenant"),
                connection("https://data.example", null));
        var result = resolver.resolve("ACME", REQUEST);
        assertEquals("HTTP_GET", result.path("kind").asText());
        var operation = result.path("operation");
        assertEquals("https://data.example/rpc/summary", operation.path("url").asText());
        assertEquals("ACME", operation.path("isolation").path("tenantValue").asText());
        assertEquals("14", operation.path("parameters").path("days").asText());
        assertFalse(operation.path("parameters").has("tenant"));
        assertFalse(result.toString().contains("never-return-this"));
        assertEquals(0, credentials.calls);
    }
    @Test void returnsOnlyShortLivedBearerAndCheckedBigQueryPlan() {
        setup("BIGQUERY", Map.of("kind", "BIGQUERY", "readOnly", true, "tenantParameter", "tenant",
                "projectId", "billing-project", "location", "us-central1", "query", "SELECT @days, @tenant",
                "maximumBytesBilled", 1000, "parameterTypes", Map.of("days", "INT64", "tenant", "STRING")),
                connection("https://bigquery.googleapis.com", AuthType.GOOGLE_SERVICE_ACCOUNT));
        credentials.value = ResolvedAuth.headers(Map.of("Authorization", "Bearer short-lived-token"), null);
        var result = resolver.resolve("ACME", REQUEST);
        assertEquals("BIGQUERY", result.path("kind").asText());
        assertEquals("short-lived-token", result.path("operation").path("accessToken").asText());
        assertEquals(1000, result.path("operation").path("plan").path("maximumBytesBilled").asInt());
        assertEquals("ACME", result.path("operation").path("parameters").path("tenant").asText());
        assertFalse(result.toString().contains("never-return-this"));
    }
    @Test void rejectsCredentialsInUrlsQueriesOrUnsupportedHeaders() {
        for (String url : new String[]{"http://data.example", "https://secret@data.example", "https://data.example?secret=1"}) {
            setup("HTTP_GET", Map.of("kind", "HTTP_GET", "readOnly", true, "tenantParameter", "tenant"), connection(url, null));
            assertThrows(OperationInvocationException.class, () -> resolver.resolve("ACME", REQUEST));
        }
        setup("HTTP_GET", Map.of("kind", "HTTP_GET", "readOnly", true, "tenantParameter", "tenant"), connection("https://data.example", AuthType.GOOGLE_SERVICE_ACCOUNT));
        for (ResolvedAuth auth : new ResolvedAuth[]{new ResolvedAuth(Map.of(), Map.of("key", "secret"), null),
                ResolvedAuth.headers(Map.of("Host", "evil.example"), null), ResolvedAuth.headers(Map.of("Authorization", "bad\r\nvalue"), null)}) {
            credentials.value = auth;
            assertThrows(OperationInvocationException.class, () -> resolver.resolve("ACME", REQUEST));
        }
    }
    @Test void refusesIneligibleOperationsAndRedactsCatalogFailures() {
        setup("HTTP_GET", Map.of("kind", "HTTP_GET", "readOnly", false, "tenantParameter", "tenant"), connection("https://data.example", null));
        assertThrows(OperationInvocationException.class, () -> resolver.resolve("ACME", REQUEST));
        assertEquals(0, credentials.calls);
        connections.failure = new IllegalStateException("private credential");
        var error = assertThrows(OperationInvocationException.class, () -> resolver.resolve("ACME", REQUEST));
        assertEquals("Dashboard operation could not be resolved", error.getMessage());
        assertNull(error.getCause());
    }
    @Test void validatesBoundsBeforeAccessingTheCatalog() {
        assertThrows(OperationInvocationException.class, () -> resolver.resolve("ACME", null));
        assertThrows(OperationInvocationException.class, () -> resolver.resolve("", REQUEST));
        assertEquals(0, connections.calls + operations.calls + credentials.calls);
    }
    private static class Connections extends IntegrationConnectionResolver {
        ResolvedConnection value; RuntimeException failure; int calls;
        Connections() { super(null, null, null); }
        @Override public ResolvedConnection resolveActive(String tenant, String id) {
            calls++; assertEquals("ACME", tenant); assertEquals("connection", id);
            if (failure != null) throw failure;
            return value;
        }
    }
    private static class Operations extends IntegrationOperationRepository {
        IntegrationOperation value; int calls;
        Operations() { super(null); }
        @Override public IntegrationOperation findByConnectionAndId(String connection, String id) {
            calls++; assertEquals("connection", connection); assertEquals("operation", id); return value;
        }
    }
    private static class Credentials extends CredentialAuthRegistry {
        ResolvedAuth value; int calls;
        Credentials() { super(List.of()); }
        @Override public ResolvedAuth resolve(CredentialAuthContext context) { calls++; return value; }
    }
}
