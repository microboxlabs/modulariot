package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DashboardOperationPolicyTest {
    private static Map<String, Object> settings() {
        return Map.of("readOnly", true, "kind", "HTTP_GET", "tenantParameter", "tenant");
    }

    private static Map<String, Object> schema(Map<String, Object> settings) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", Map.of(
                "days", Map.of("type", "integer", "minimum", 1, "maximum", 30),
                "tenant", Map.of("type", "string")));
        schema.put("required", List.of("days"));
        schema.put("additionalProperties", false);
        schema.put("x-dashboard", settings);
        return schema;
    }

    private static IntegrationOperation operation(Map<String, Object> schema) {
        return new IntegrationOperation("op", "connection", "summary", "GET", "/summary", schema, Map.of(), false);
    }


    private static OperationInvocationException refused(IntegrationOperation operation, Map<String, Object> parameters) {
        return assertThrows(OperationInvocationException.class,
                () -> DashboardOperationPolicy.prepare(operation, "ACME", parameters));
    }

    @Test
    void allowsOneHundredCallerParametersPlusTheHostTenant() {
        var schema = schema(settings());
        Map<String, Object> properties = new LinkedHashMap<>();
        Map<String, Object> parameters = new LinkedHashMap<>();
        properties.put("tenant", Map.of("type", "string"));
        for (int i = 0; i < 100; i++) {
            properties.put("p" + i, Map.of("type", "integer"));
            parameters.put("p" + i, i);
        }
        schema.put("properties", properties);
        schema.remove("required");
        assertEquals(101, DashboardOperationPolicy.prepare(operation(schema), "ACME", parameters).parameters().size());
        parameters.put("extra", 1);
        refused(operation(schema), parameters);
    }

    @Test
    void includesTheInjectedTenantInTheByteLimit() {
        var operation = operation(schema(settings()));
        var parameters = Map.<String, Object>of("days", 1);
        String oversizedTenant = "t".repeat(262_144);
        assertThrows(OperationInvocationException.class,
                () -> DashboardOperationPolicy.prepare(operation, oversizedTenant, parameters));
    }

    @Test
    void validatesAndInjectsTheAuthorizedTenantWithoutMutatingInputs() {
        Map<String, Object> schema = schema(settings());
        Map<String, Object> parameters = Map.of("days", 30);
        var plan = DashboardOperationPolicy.prepare(operation(schema), "ACME", parameters);
        assertEquals("HTTP_GET", plan.kind());
        assertEquals("ACME", plan.parameters().get("tenant").textValue());
        assertEquals(30, plan.parameters().get("days").intValue());
        assertFalse(parameters.containsKey("tenant"));
        assertEquals(settings(), schema.get("x-dashboard"));
    }

    @Test
    void refusesTenantOverridesEvenWhenTheClaimedValueMatches() {
        for (String tenant : List.of("ACME", "OTHER")) {
            refused(operation(schema(settings())), Map.of("days", 1, "tenant", tenant));
        }
    }

    @Test
    void refusesMissingOrAmbiguousIsolationAndUnsafeMethods() {
        List<Map<String, Object>> invalid = List.of(
                Map.of(), Map.of("readOnly", false),
                Map.of("readOnly", true, "kind", "HTTP_GET"),
                Map.of("readOnly", true, "kind", "HTTP_GET", "tenantParameter", "tenant", "credentialScoped", true),
                Map.of("readOnly", true, "kind", "BIGQUERY", "credentialScoped", true));
        for (var settings : invalid) {
            refused(operation(schema(settings)), Map.of("days", 1));
        }
    }

    @Test
    void requiresExplicitCredentialScopedIsolationWhenThereIsNoTenantParameter() {
        var plan = DashboardOperationPolicy.prepare(operation(schema(Map.of(
                "readOnly", true, "kind", "HTTP_GET", "credentialScoped", true))), "ACME", Map.of("days", 1));
        assertFalse(plan.parameters().has("tenant"));
    }

    @Test
    void enforcesRequiredFieldsTypesBoundsAndUnknownParameterRejection() {
        List<Map<String, Object>> invalid = List.of(
                Map.of(), Map.of("days", "30"), Map.of("days", 31), Map.of("days", 0),
                Map.of("days", 1, "sql", "SELECT private"), Map.of("days", Map.of("nested", true)),
                Map.of("days", List.of(List.of(1))), Map.of("days", "x".repeat(2049)));
        for (var parameters : invalid) {
            var error = refused(operation(schema(settings())), parameters);
            assertEquals("Dashboard operation or parameters are not permitted", error.getMessage());
        }
    }

    @Test
    void requiresAClosedObjectSchema() {
        for (String field : List.of("type", "properties", "additionalProperties")) {
            var schema = schema(settings());
            schema.remove(field);
            refused(operation(schema), Map.of("days", 1));
        }
    }

    @Test
    void rejectsReferencesAndRegularExpressionsInsteadOfLoadingOrExecutingThem() {
        for (String ref : List.of("#", "https://example.invalid/schema", "classpath:secret.json")) {
            var schema = schema(settings());
            schema.put("$ref", ref);
            refused(operation(schema), Map.of("days", 1));
        }
        var remoteDialect = schema(settings());
        remoteDialect.put("$schema", "https://example.invalid/schema");
        refused(operation(remoteDialect), Map.of("days", 1));
        var schema = schema(settings());
        schema.put("propertyNames", Map.of("pattern", "(a+)+$"));
        refused(operation(schema), Map.of("days", 1));
    }

    @Test
    void limitsSchemaDepthAndSize() {
        var schema = schema(settings());
        Map<String, Object> nested = Map.of("type", "string");
        for (int i = 0; i < 20; i++) nested = Map.of("items", nested);
        schema.put("unused", nested);
        refused(operation(schema), Map.of("days", 1));
        schema.remove("unused");
        schema.put("description", "x".repeat(65537));
        refused(operation(schema), Map.of("days", 1));
    }

    @Test
    void allowsBoundedFlatScalarArraysAndNull() {
        var schema = schema(Map.of("readOnly", true, "kind", "HTTP_GET", "credentialScoped", true));
        schema.put("properties", Map.of("days", Map.of("type", "array")));
        List<Object> values = new ArrayList<>(List.of(1, false, "value"));
        values.add(null);
        var plan = DashboardOperationPolicy.prepare(operation(schema), "ACME", Map.of("days", values));
        assertEquals(4, plan.parameters().get("days").size());
        assertEquals(false, plan.parameters().get("days").get(1).booleanValue());
    }
}
