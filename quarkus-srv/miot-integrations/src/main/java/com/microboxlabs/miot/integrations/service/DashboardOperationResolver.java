package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Private catalog boundary: resolves authorized plans but never executes a data query. */
@ApplicationScoped
public class DashboardOperationResolver {
    private static final String PARAMETER_TYPES = "parameterTypes";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> HEADERS = Set.of("authorization", "x-api-key", "apikey");
    private final IntegrationConnectionResolver connections;
    private final IntegrationOperationRepository operations;
    private final CredentialAuthRegistry credentials;
    private final long byteCap;

    @Inject
    public DashboardOperationResolver(IntegrationConnectionResolver connections, IntegrationOperationRepository operations,
            CredentialAuthRegistry credentials,
            @ConfigProperty(name = "miot.dashboards.bigquery.maximum-bytes-billed", defaultValue = "1000000000") long byteCap) {
        this.connections = connections;
        this.operations = operations;
        this.credentials = credentials;
        this.byteCap = byteCap;
    }

    public ObjectNode resolve(String tenantCode, DashboardOperationService.Request request) {
        DashboardOperationService.validate(request);
        if (tenantCode == null || tenantCode.isBlank()) throw refused();
        try {
            var connection = connections.resolveActive(tenantCode, request.connectionId());
            var operation = operations.findByConnectionAndId(request.connectionId(), request.operationId());
            var plan = DashboardOperationPolicy.prepare(operation, tenantCode, request.parameters());
            ObjectNode resolved = switch (plan.kind()) {
                case "BIGQUERY" -> bigQuery(connection, plan);
                case "HTTP_GET" -> http(connection, operation, plan);
                default -> throw refused();
            };
            return JSON.createObjectNode().put("kind", plan.kind()).set("operation", resolved);
        } catch (RuntimeException error) {
            // Never expose source SQL, private keys, credentials or provider diagnostics.
            throw refused();
        }
    }

    private ObjectNode bigQuery(ResolvedConnection connection, DashboardOperationPolicy.Plan source) {
        String base = String.valueOf(connection.baseUrl());
        if (connection.authType() != AuthType.GOOGLE_SERVICE_ACCOUNT
                || !("https://bigquery.googleapis.com".equals(base) || "https://bigquery.googleapis.com/".equals(base))) throw refused();
        var checked = new BigQueryDashboardPlan(source, byteCap);
        var auth = headers(connection);
        String authorization = auth.path("authorization").asText();
        if (!authorization.startsWith("Bearer ") || authorization.length() <= 7) throw refused();
        ObjectNode plan = JSON.createObjectNode().put("projectId", checked.project).put("location", checked.location)
                .put("sql", source.settings().path("query").asText()).put("maximumBytesBilled", checked.maximumBytesBilled);
        plan.set(PARAMETER_TYPES, source.settings().path(PARAMETER_TYPES).deepCopy());
        ObjectNode result = JSON.createObjectNode().put("accessToken", authorization.substring(7));
        result.set("plan", plan);
        result.set("parameters", source.parameters().deepCopy());
        return result;
    }

    private ObjectNode http(ResolvedConnection connection, IntegrationOperation operation, DashboardOperationPolicy.Plan plan) {
        IntegrationOperationInvoker.requireParameterFreeAddress(connection.baseUrl(), operation.path());
        var url = IntegrationOperationInvoker.buildUrl(connection.baseUrl(), operation.path(), Map.of());
        if (!"https".equalsIgnoreCase(url.getScheme()) || url.getUserInfo() != null || url.getHost() == null) throw refused();
        ObjectNode result = JSON.createObjectNode().put("url", url.toString()).put("readOnly", true);
        var auth = headers(connection);
        result.set("headers", auth);
        var isolation = result.putObject("isolation");
        String tenantParameter = plan.settings().path("tenantParameter").asText("");
        if (tenantParameter.isEmpty()) {
            if (auth.isEmpty()) throw refused();
            isolation.put("credentialScoped", true);
        } else {
            isolation.put("tenantParameter", tenantParameter).put("tenantValue", plan.parameters().path(tenantParameter).asText());
        }
        var values = result.putObject("parameters");
        var types = result.putObject(PARAMETER_TYPES);
        plan.parameters().fields().forEachRemaining(entry -> {
            if (!entry.getKey().equals(tenantParameter)) {
                var value = entry.getValue();
                values.put(entry.getKey(), value.isTextual() ? value.textValue() : value.toString());
                types.put(entry.getKey(), "string");
            }
        });
        return result;
    }

    private ObjectNode headers(ResolvedConnection connection) {
        ResolvedAuth auth = connection.hasAuth() ? credentials.resolve(connection.authContext())
                : new ResolvedAuth(Map.of(), Map.of(), null);
        if (!auth.queryParams().isEmpty()) throw refused();
        ObjectNode headers = JSON.createObjectNode();
        auth.headers().forEach((key, value) -> {
            String name = key.toLowerCase(Locale.ROOT);
            if (!HEADERS.contains(name) || value == null || value.contains("\r") || value.contains("\n") || headers.has(name)) throw refused();
            headers.put(name, value);
        });
        return headers;
    }

    private static OperationInvocationException refused() {
        return new OperationInvocationException("Dashboard operation could not be resolved");
    }
}
