package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.regex.AllowRegularExpressionFactory;
import com.networknt.schema.regex.JDKRegularExpressionFactory;
import com.networknt.schema.resource.DisallowSchemaLoader;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Dashboard eligibility belongs to the host operation, never to an editable dashboard. */
public final class DashboardOperationPolicy {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final JsonSchemaFactory SCHEMAS = JsonSchemaFactory.getInstance(
            SpecVersion.VersionFlag.V202012,
            builder -> builder.schemaLoaders(loaders -> loaders.add(DisallowSchemaLoader.getInstance())));
    private static final SchemaValidatorsConfig VALIDATION = SchemaValidatorsConfig.builder()
            .cacheRefs(false).failFast(true).formatAssertionsEnabled(true)
            .regularExpressionFactory(new AllowRegularExpressionFactory(
                    JDKRegularExpressionFactory.getInstance(), ignored -> false))
            .build();
    private static final Cache<String, JsonSchema> VALIDATORS = Caffeine.newBuilder().maximumSize(128).build();

    private DashboardOperationPolicy() {
    }

    public record Plan(String kind, ObjectNode parameters, JsonNode settings) {
    }

    /** Caller must first resolve an ACTIVE connection owned by the authorized tenant. */
    public static Plan prepare(IntegrationOperation operation, String tenantCode, Map<String, Object> parameters) {
        if (operation == null || operation.requestSchema() == null || tenantCode == null || tenantCode.isBlank()) {
            throw refused();
        }
        try {
            ObjectNode schema = JSON.valueToTree(operation.requestSchema());
            boundSchema(schema, 0);
            if (schema.toString().getBytes(StandardCharsets.UTF_8).length > 65_536) throw refused();
            JsonNode settings = schema.remove("x-dashboard");
            String kind = operationKind(operation, settings);
            ObjectNode values = parameterValues(parameters);
            bindTenant(settings, values, tenantCode);
            requireBoundedParameters(values);
            requireClosedSchema(schema);
            JsonSchema validator = VALIDATORS.get(schema.toString(), key -> SCHEMAS.getSchema(key, VALIDATION));
            if (!validator.validate(values).isEmpty()) throw refused();
            return new Plan(kind, values, settings);
        } catch (RuntimeException e) {
            // Validation messages may contain parameter values or operation configuration.
            throw refused();
        }
    }

    private static String operationKind(IntegrationOperation operation, JsonNode settings) {
        if (settings == null || !settings.isObject() || !settings.path("readOnly").isBoolean()
                || !settings.path("readOnly").booleanValue()) throw refused();
        String kind = settings.path("kind").asText();
        boolean allowed = ("HTTP_GET".equals(kind) && "GET".equalsIgnoreCase(operation.method()))
                || ("BIGQUERY".equals(kind) && "POST".equalsIgnoreCase(operation.method()));
        if (!allowed) throw refused();
        return kind;
    }

    private static void bindTenant(JsonNode settings, ObjectNode values, String tenantCode) {
        JsonNode parameter = settings.get("tenantParameter");
        boolean credentialScoped = settings.path("credentialScoped").isBoolean()
                && settings.path("credentialScoped").booleanValue();
        if (parameter == null) {
            if (!credentialScoped) throw refused();
            return;
        }
        if (credentialScoped || !parameter.isTextual() || parameter.textValue().isBlank()
                || parameter.textValue().length() > 128 || values.has(parameter.textValue())) throw refused();
        values.put(parameter.textValue(), tenantCode);
    }

    private static void requireClosedSchema(ObjectNode schema) {
        if (!"object".equals(schema.path("type").asText()) || !schema.path("properties").isObject()
                || !schema.path("additionalProperties").isBoolean()
                || schema.path("additionalProperties").booleanValue()) throw refused();
    }

    private static ObjectNode parameterValues(Map<String, Object> parameters) {
        if (parameters == null || parameters.size() > 100) throw refused();
        ObjectNode values = JSON.valueToTree(parameters);
        for (JsonNode value : values) {
            if (value.isArray()) {
                if (value.size() > 100) throw refused();
                for (JsonNode item : value) requireScalar(item);
            } else {
                requireScalar(value);
            }
        }
        requireBoundedParameters(values);
        return values;
    }

    private static void requireBoundedParameters(ObjectNode values) {
        if (values.toString().getBytes(StandardCharsets.UTF_8).length > 262_144) throw refused();
    }

    private static void requireScalar(JsonNode value) {
        if (value.isNull() || value.isBoolean()) return;
        if (value.isNumber() && Double.isFinite(value.doubleValue())) return;
        if (value.isTextual() && value.textValue().codePointCount(0, value.textValue().length()) <= 2048) return;
        throw refused();
    }

    private static int boundSchema(JsonNode node, int depth) {
        if (depth > 16 || node.has("$ref") || node.has("$dynamicRef") || node.has("$recursiveRef")
                || node.has("pattern") || node.has("patternProperties")) {
            throw refused();
        }
        if (node.has("$schema")
                && !"https://json-schema.org/draft/2020-12/schema".equals(node.path("$schema").asText())) throw refused();
        int count = 1;
        for (JsonNode child : node) {
            count += boundSchema(child, depth + 1);
            if (count > 1024) throw refused();
        }
        return count;
    }

    private static OperationInvocationException refused() {
        return new OperationInvocationException("Dashboard operation or parameters are not permitted");
    }
}
