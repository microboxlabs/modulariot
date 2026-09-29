package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class BigQueryDashboardExecutorTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final DashboardOperationService.Limits LIMITS = new DashboardOperationService.Limits(10, 10000);
    private static final ResolvedConnection CONNECTION = new ResolvedConnection("billing",
            URI.create("https://bigquery.googleapis.com"), Map.of(), Map.of(), AuthType.GOOGLE_SERVICE_ACCOUNT,
            CredentialType.GOOGLE_SERVICE_ACCOUNT, Map.of());

    private static Map<String, Object> settings() {
        return new LinkedHashMap<>(Map.of("projectId", "project-test", "location", "us-central1",
                "query", "SELECT @tenant AS tenant", "maximumBytesBilled", "1000000",
                "parameterTypes", Map.of("tenant", "STRING")));
    }

    private static DashboardOperationPolicy.Plan plan(Map<String, Object> settings) {
        return new DashboardOperationPolicy.Plan("BIGQUERY", JSON.createObjectNode().put("tenant", "ACME"),
                JSON.valueToTree(settings));
    }

    @Test
    void dryRunThenBoundedJobUsesOnlyTypedNamedValues() throws Exception {
        var executor = new Fake();
        var plan = plan(settings());
        assertEquals("[{\"tenant\":\"ACME\"}]", executor.execute(CONNECTION, plan, LIMITS));
        assertEquals(3, executor.calls.size());
        var dry = executor.bodies.get(0);
        var job = executor.bodies.get(1);
        assertTrue(dry.path("configuration").path("dryRun").asBoolean());
        assertFalse(job.path("configuration").path("dryRun").asBoolean());
        assertEquals("20000", job.path("configuration").path("jobTimeoutMs").asText());
        var query = job.path("configuration").path("query");
        assertEquals("1000000", query.path("maximumBytesBilled").asText());
        assertEquals("SELECT @tenant AS tenant", query.path("query").asText());
        assertEquals("ACME", query.path("queryParameters").get(0).path("parameterValue").path("value").asText());
        assertFalse(query.path("useLegacySql").asBoolean());
        assertTrue(executor.calls.get(2).contains("maxResults=11"));
    }

    @Test
    void refusesNonSelectDryRunsAndOverBudgetQueriesBeforeSubmission() {
        for (String type : List.of("SCRIPT", "INSERT", "UPDATE", "CREATE_TABLE", "")) {
            var executor = new Fake();
            executor.statementType = type;
            var plan = plan(settings());
            assertThrows(OperationInvocationException.class, () -> executor.execute(CONNECTION, plan, LIMITS));
            assertEquals(1, executor.calls.size());
        }
        var executor = new Fake();
        executor.dryBytes = "1000001";
        var plan = plan(settings());
        assertThrows(OperationInvocationException.class, () -> executor.execute(CONNECTION, plan, LIMITS));
        assertEquals(1, executor.calls.size());
    }

    @Test
    void refusesUnsafeOperatorConfigurationBeforeAnyRequest() {
        for (var entry : Map.<String, Object>of("projectId", "../other", "location", "US&other=x",
                "query", "", "maximumBytesBilled", "1000000001", "parameterTypes", Map.of("tenant", "STRUCT")).entrySet()) {
            var settings = settings();
            settings.put(entry.getKey(), entry.getValue());
            var plan = plan(settings);
            var executor = new Fake();
            assertThrows(OperationInvocationException.class, () -> executor.execute(CONNECTION, plan, LIMITS));
            assertEquals(0, executor.calls.size());
        }
    }

    @Test
    void credentialCannotBeSentToAnotherHost() {
        var connection = new ResolvedConnection("billing", URI.create("https://other.example"), Map.of(), Map.of(),
                AuthType.GOOGLE_SERVICE_ACCOUNT, CredentialType.GOOGLE_SERVICE_ACCOUNT, Map.of());
        var executor = new Fake();
        var plan = plan(settings());
        assertThrows(OperationInvocationException.class, () -> executor.execute(connection, plan, LIMITS));
        assertEquals(0, executor.calls.size());
    }

    @Test
    void cancelsSubmittedJobsOnResultTransportFailure() {
        var executor = new Fake();
        executor.failResults = true;
        var plan = plan(settings());
        assertThrows(IOException.class, () -> executor.execute(CONNECTION, plan, LIMITS));
        assertEquals(1, executor.cancellations);
    }

    @Test
    void cancelsSubmittedJobsWhenResultsAreTruncated() {
        var executor = new Fake();
        executor.truncated = true;
        var plan = plan(settings());
        assertThrows(OperationInvocationException.class, () -> executor.execute(CONNECTION, plan, LIMITS));
        assertEquals(1, executor.cancellations);
    }

    @Test
    void refusesMissingRowsEvenWithoutPaginationToken() {
        var executor = new Fake();
        executor.totalRows = "2";
        var plan = plan(settings());
        assertThrows(OperationInvocationException.class, () -> executor.execute(CONNECTION, plan, LIMITS));
        assertEquals(1, executor.cancellations);
    }

    @Test
    void supportsTypedArraysAndNullWithoutSqlSubstitution() {
        var settings = settings();
        settings.put("parameterTypes", Map.of("items", "ARRAY<INT64>", "optional", "STRING"));
        var values = JSON.createObjectNode().putNull("optional");
        values.putArray("items").add(1).add(2);
        var plan = new BigQueryDashboardPlan(new DashboardOperationPolicy.Plan("BIGQUERY", values, JSON.valueToTree(settings)), 1000000);
        var params = plan.query.path("queryParameters");
        assertEquals(2, params.size());
        assertTrue(params.get(0).path("parameterValue").path("value").isNull());
        assertEquals("INT64", params.get(1).path("parameterType").path("arrayType").path("type").asText());
    }

    private static class Fake extends BigQueryDashboardExecutor {
        final List<String> calls = new ArrayList<>();
        final List<JsonNode> bodies = new ArrayList<>();
        String statementType = "SELECT";
        String dryBytes = "100";
        String totalRows = "1";
        boolean failResults;
        boolean truncated;
        int cancellations;
        Fake() { super(credentials(), 1000000000); }
        @Override JsonNode call(String method, String url, JsonNode body, ResolvedAuth auth, Duration timeout, int maxBytes)
                throws IOException {
            calls.add(url);
            bodies.add(body);
            assertTrue(timeout.toMillis() > 0 && timeout.toMillis() <= 20000);
            if (url.contains("/cancel?")) {
                cancellations++;
                return JSON.createObjectNode();
            }
            if (body != null && body.path("configuration").path("dryRun").asBoolean()) {
                var result = JSON.createObjectNode();
                result.putObject("statistics").put("totalBytesProcessed", dryBytes)
                        .putObject("query").put("statementType", statementType);
                return result;
            }
            if (url.contains("/queries/")) {
                if (failResults) throw new IOException("private provider error");
                var result = JSON.createObjectNode().put("jobComplete", true).put("totalRows", totalRows);
                if (truncated) result.put("pageToken", "next");
                result.putObject("schema").putArray("fields").addObject().put("name", "tenant").put("type", "STRING");
                result.putArray("rows").addObject().putArray("f").addObject().put("v", "ACME");
                return result;
            }
            return JSON.createObjectNode();
        }
    }

    private static CredentialAuthRegistry credentials() {
        return new CredentialAuthRegistry(List.of(new CredentialAuthProvider() {
            @Override public Set<AuthType> supportedTypes() { return Set.of(AuthType.GOOGLE_SERVICE_ACCOUNT); }
            @Override public ResolvedAuth resolve(CredentialAuthContext context) {
                return ResolvedAuth.headers(Map.of("Authorization", "Bearer test"), null);
            }
        }));
    }
}
