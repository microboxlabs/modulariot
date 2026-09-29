package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Semaphore;

/** Blocking host boundary: only active tenant connections and opted-in saved operations. */
@ApplicationScoped
public class DashboardOperationService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final IntegrationConnectionResolver connections;
    private final IntegrationOperationRepository operations;
    private final IntegrationOperationInvoker invoker;
    private final Semaphore slots = new Semaphore(8);

    public record Limits(int maxRows, int maxBytes) { }
    public record Request(String tenantId, String scopeId, String dashboardSlug, String userId,
            String connectionId, String operationId, Map<String, Object> parameters, Limits limits) { }

    @Inject
    public DashboardOperationService(IntegrationConnectionResolver connections,
            IntegrationOperationRepository operations, IntegrationOperationInvoker invoker) {
        this.connections = connections;
        this.operations = operations;
        this.invoker = invoker;
    }

    /** tenantCode is resolved from the authenticated service request's organization slug. */
    public ObjectNode execute(String tenantCode, Request request) {
        validate(request);
        if (tenantCode == null || tenantCode.isBlank() || !slots.tryAcquire()) throw refused();
        try {
            var connection = connections.resolveActive(tenantCode, request.connectionId());
            var operation = operations.findByConnectionAndId(request.connectionId(), request.operationId());
            var plan = DashboardOperationPolicy.prepare(operation, tenantCode, request.parameters());
            if (!"HTTP_GET".equals(plan.kind())) throw refused();
            Map<String, String> parameters = new LinkedHashMap<>();
            plan.parameters().fields().forEachRemaining(entry -> parameters.put(entry.getKey(),
                    entry.getValue().isTextual() ? entry.getValue().textValue() : entry.getValue().toString()));
            var response = invoker.executeBounded(connection, operation, parameters, request.limits().maxBytes());
            if (!response.successful() || response.body() == null) throw refused();
            return result(response.body(), request.limits());
        } catch (RuntimeException | IOException e) {
            // Provider failures can contain credentials, URLs or data. Never forward them.
            throw refused();
        } finally {
            slots.release();
        }
    }

    public static void validate(Request request) {
        if (request == null || request.limits() == null || request.parameters() == null
                || request.limits().maxRows() < 1 || request.limits().maxRows() > 5_000
                || request.limits().maxBytes() < 1 || request.limits().maxBytes() > 2_097_152) throw refused();
        requireId(request.tenantId());
        requireId(request.scopeId());
        requireId(request.dashboardSlug());
        requireId(request.userId());
        requireId(request.connectionId());
        requireId(request.operationId());
    }

    private static void requireId(String value) {
        if (value == null || value.isBlank() || value.length() > 256) throw refused();
    }

    private static ObjectNode result(String body, Limits limits) throws IOException {
        if (body.getBytes(StandardCharsets.UTF_8).length > limits.maxBytes()) throw refused();
        JsonNode rows = JSON.readTree(body);
        if (rows == null || !rows.isArray() || rows.size() > limits.maxRows()) throw refused();
        for (JsonNode row : rows) {
            if (!row.isObject() || row.size() > 100) throw refused();
            for (JsonNode value : row) requireValue(value);
        }
        ObjectNode result = JSON.createObjectNode().set("rows", rows);
        if (result.toString().getBytes(StandardCharsets.UTF_8).length > limits.maxBytes()) throw refused();
        return result;
    }

    private static void requireValue(JsonNode value) {
        if (value.isArray()) {
            if (value.size() > 100) throw refused();
            for (JsonNode item : value) requireScalar(item);
        } else {
            requireScalar(value);
        }
    }

    private static void requireScalar(JsonNode value) {
        if (value.isNull() || value.isBoolean()) return;
        if (value.isNumber() && Double.isFinite(value.doubleValue())) return;
        if (value.isTextual() && value.textValue().codePointCount(0, value.textValue().length()) <= 2048) return;
        throw refused();
    }

    private static OperationInvocationException refused() {
        return new OperationInvocationException("Dashboard operation could not be completed");
    }
}
