package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.function.Supplier;
import io.vertx.pgclient.PgException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * What the dashboard server needs to let authors write queries against a tenant's BigQuery
 * connections: the connections, a token for one, and its saved queries. A saved query is an
 * operation with {@code x-dashboard}, the same one dashboards already run, so a query saved
 * here appears in the dashboard catalog. BigQuery itself is called by the dashboard server.
 */
@ApplicationScoped
public class DashboardAuthoringService {
    public static final String OPERATION_PATH = "/bigquery/v2/queries";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String DASHBOARD = "x-dashboard";
    private static final String PARAMETER_TYPES = "parameterTypes";
    private static final String TYPE = "type";
    private static final Pattern NAME = Pattern.compile("[A-Za-z_]\\w{0,127}");
    private static final Pattern LOCATION = Pattern.compile("[A-Za-z0-9-]{2,64}");
    private static final Set<String> TYPES = Set.of("STRING", "INT64", "FLOAT64", "NUMERIC", "BIGNUMERIC",
            "BOOL", "DATE", "DATETIME", "TIME", "TIMESTAMP");
    private static final int MAX_COLUMNS = 100;

    private final IntegrationConnectionRepository connections;
    private final IntegrationConnectionResolver resolver;
    private final IntegrationOperationRepository operations;
    private final CredentialAuthRegistry credentials;
    private final long byteCap;

    public record Source(String id, String label, String kind, String defaultProjectId) {
    }

    public record Access(String accessToken, String expiresAt) {
    }

    public record Parameter(String name, String type, String sample) {
    }

    public record Column(String name, String type, String mode) {
    }

    /** What an author saves; {@code columns} are those of the last estimate. */
    public record Content(String name, String description, String projectId, String location, String sql,
            Long maximumBytesBilled, List<Parameter> parameters, List<Column> columns) {
    }

    public record Plan(String id, String sourceId, String name, String description, String projectId,
            String location, String sql, long maximumBytesBilled, List<Parameter> parameters, List<Column> columns,
            String revision, String updatedAt, String updatedBy) {
    }

    /** The query was saved by someone else, or its name is taken. */
    public static class ConflictException extends RuntimeException {
        public ConflictException(String message) {
            super(message);
        }
    }

    @Inject
    public DashboardAuthoringService(IntegrationConnectionRepository connections,
            IntegrationConnectionResolver resolver, IntegrationOperationRepository operations,
            CredentialAuthRegistry credentials,
            @ConfigProperty(name = "miot.dashboards.bigquery.maximum-bytes-billed", defaultValue = "1000000000")
            long byteCap) {
        this.connections = connections;
        this.resolver = resolver;
        this.operations = operations;
        this.credentials = credentials;
        this.byteCap = byteCap;
    }

    /** Active BigQuery connections with a Google service account that names its project. */
    public List<Source> sources(String tenantCode) {
        List<Source> sources = new ArrayList<>();
        for (IntegrationConnection connection : connections.listByTenant(tenantCode)) {
            if (connection.status() != ConnectionStatus.ACTIVE || !BigQueryProbe.isBigQuery(connection)) continue;
            try {
                ResolvedConnection resolved = resolver.resolve(tenantCode, connection);
                String project = projectOf(resolved);
                if (resolved.authType() == AuthType.GOOGLE_SERVICE_ACCOUNT && project != null) {
                    sources.add(new Source(connection.id(), connection.name(), "BIGQUERY", project));
                }
            } catch (ConnectionResolutionException e) {
                // A connection whose credential cannot be read is not offered.
            }
        }
        return sources;
    }

    /** @return null when the source is not one of the tenant's BigQuery sources */
    public Access access(String tenantCode, String sourceId) {
        ResolvedConnection resolved = resolvedSource(tenantCode, sourceId);
        if (resolved == null) return null;
        var auth = credentials.resolve(resolved.authContext());
        String authorization = auth.headers().entrySet().stream()
                .filter(header -> "authorization".equalsIgnoreCase(header.getKey()))
                .map(Map.Entry::getValue).findFirst().orElse("");
        if (!authorization.startsWith("Bearer ") || authorization.length() <= 7) return null;
        return new Access(authorization.substring(7),
                auth.expiresAt() == null ? null : auth.expiresAt().toString());
    }

    /** @return null when the source is unknown */
    public List<Plan> list(String tenantCode, String sourceId) {
        if (source(tenantCode, sourceId) == null) return null;
        return operations.listVersioned(sourceId).stream()
                .map(version -> toPlan(sourceId, version))
                .filter(plan -> plan != null)
                .toList();
    }

    /** @return null when the source or the query is unknown */
    public Plan get(String tenantCode, String sourceId, String planId) {
        if (source(tenantCode, sourceId) == null) return null;
        var version = operations.findVersioned(sourceId, planId);
        return version == null ? null : toPlan(sourceId, version);
    }

    /** @return null when the source is unknown */
    public Plan create(String tenantCode, String sourceId, Content content, String actor) {
        if (source(tenantCode, sourceId) == null) return null;
        Map<String, Object> schema = requestSchema(content, actor);
        String name = content.name().strip();
        if (operations.findByConnectionAndName(sourceId, name) != null) {
            throw new ConflictException("A query with that name already exists");
        }
        IntegrationOperation created = withNameConflict(() -> operations.create(new IntegrationOperation(UUID.randomUUID().toString(),
                sourceId, name, "POST", OPERATION_PATH, schema, Map.of(), false)));
        return toPlan(sourceId, operations.findVersioned(sourceId, created.id()));
    }

    /** @return null when the source or the query is unknown */
    public Plan update(String tenantCode, String sourceId, String planId, Content content,
            String expectedRevision, String actor) {
        if (source(tenantCode, sourceId) == null) return null;
        Map<String, Object> schema = requestSchema(content, actor);
        String name = content.name().strip();
        var current = operations.findVersioned(sourceId, planId);
        if (current == null || toPlan(sourceId, current) == null) return null;
        var sameName = operations.findByConnectionAndName(sourceId, name);
        if (sameName != null && !sameName.id().equals(planId)) {
            throw new ConflictException("A query with that name already exists");
        }
        var updated = withNameConflict(() -> operations.updateIfUnchanged(sourceId, planId, name, schema, instantOf(expectedRevision)));
        if (updated == null) throw new ConflictException("The query was saved by someone else");
        return toPlan(sourceId, updated);
    }

    /** @return false when the source or the query is unknown */
    public boolean remove(String tenantCode, String sourceId, String planId) {
        if (source(tenantCode, sourceId) == null) return false;
        var current = operations.findVersioned(sourceId, planId);
        if (current == null || toPlan(sourceId, current) == null) return false;
        operations.deactivate(sourceId, planId);
        return true;
    }

    private static <T> T withNameConflict(Supplier<T> write) {
        try {
            return write.get();
        } catch (PgException error) {
            if ("23505".equals(error.getSqlState())
                    && "idx_integration_operations_connection_name_active".equals(error.getConstraint())) {
                throw new ConflictException("A query with that name already exists");
            }
            throw error;
        }
    }

    /** Microseconds since the epoch: the precision Postgres keeps. */
    static String revisionOf(OffsetDateTime updatedAt) {
        Instant instant = updatedAt.toInstant();
        return Long.toString(ChronoUnit.MICROS.between(Instant.EPOCH, instant));
    }

    private static OffsetDateTime instantOf(String revision) {
        try {
            return Instant.EPOCH.plus(Long.parseLong(revision), ChronoUnit.MICROS).atOffset(ZoneOffset.UTC);
        } catch (RuntimeException e) {
            throw new ConflictException("The query was saved by someone else");
        }
    }

    private IntegrationConnection source(String tenantCode, String sourceId) {
        if (!validId(sourceId)) return null;
        IntegrationConnection connection = connections.findByTenantAndId(tenantCode, sourceId);
        return connection != null && connection.status() == ConnectionStatus.ACTIVE
                && BigQueryProbe.isBigQuery(connection) ? connection : null;
    }

    private ResolvedConnection resolvedSource(String tenantCode, String sourceId) {
        if (source(tenantCode, sourceId) == null) return null;
        try {
            ResolvedConnection resolved = resolver.resolveActive(tenantCode, sourceId);
            return resolved.authType() == AuthType.GOOGLE_SERVICE_ACCOUNT ? resolved : null;
        } catch (ConnectionResolutionException e) {
            return null;
        }
    }

    private static String projectOf(ResolvedConnection resolved) {
        Object value = resolved.publicConfig() == null ? null : resolved.publicConfig().get("projectId");
        String project = value == null ? null : value.toString();
        return BigQueryProbe.validProjectId(project) ? project : null;
    }

    private static boolean validId(String id) {
        try {
            UUID.fromString(id);
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** The request schema dashboards run, as the app's BigQuery query form writes it. */
    Map<String, Object> requestSchema(Content content, String actor) {
        validate(content);
        ObjectNode schema = JSON.createObjectNode().put(TYPE, "object").put("additionalProperties", false);
        ObjectNode properties = schema.putObject("properties");
        ArrayNode required = schema.putArray("required");
        ObjectNode dashboard = schema.putObject(DASHBOARD).put("readOnly", true).put("kind", "BIGQUERY")
                .put("credentialScoped", true).put("projectId", content.projectId()).put("location", content.location())
                .put("query", content.sql())
                .put("maximumBytesBilled", Long.toString(content.maximumBytesBilled()));
        ObjectNode types = dashboard.putObject(PARAMETER_TYPES);
        ObjectNode samples = JSON.createObjectNode();
        for (Parameter parameter : parameters(content)) {
            properties.set(parameter.name(), property(parameter.type()));
            required.add(parameter.name());
            types.put(parameter.name(), parameter.type());
            if (parameter.sample() != null) samples.put(parameter.name(), parameter.sample());
        }
        if (!samples.isEmpty()) dashboard.set("samples", samples);
        if (content.description() != null && !content.description().isBlank()) {
            dashboard.put("description", content.description().strip());
        }
        ArrayNode columns = JSON.createArrayNode();
        if (content.columns() != null) {
            content.columns().stream().limit(MAX_COLUMNS).forEach(column -> columns.addObject()
                    .put("name", column.name()).put(TYPE, column.type())
                    .put("mode", column.mode() == null ? "NULLABLE" : column.mode()));
        }
        dashboard.set("columns", columns);
        if (actor != null) dashboard.put("updatedBy", actor);
        Map<String, Object> stored = JSON.convertValue(schema, Map.class);
        var candidate = new IntegrationOperation("draft", "source", content.name(), "POST", OPERATION_PATH, stored, Map.of(), false);
        if (schema.toString().getBytes(StandardCharsets.UTF_8).length > 65_536
                || !DashboardOperationPolicy.eligible(candidate)) throw new IllegalArgumentException("Query exceeds dashboard schema limits");
        return stored;
    }

    private void validate(Content content) {
        if (content == null || content.name() == null || content.name().isBlank() || content.name().strip().length() > 128
                || !BigQueryProbe.validProjectId(content.projectId())
                || content.location() == null || !LOCATION.matcher(content.location()).matches()
                || content.sql() == null || content.sql().isBlank() || content.sql().length() > 65_536
                || content.maximumBytesBilled() == null || content.maximumBytesBilled() < 1
                || content.maximumBytesBilled() > byteCap
                || (content.description() != null && content.description().length() > 1024)) {
            throw new IllegalArgumentException("Invalid query");
        }
        Set<String> seen = new HashSet<>();
        for (Parameter parameter : parameters(content)) {
            if (parameter == null || parameter.name() == null || !NAME.matcher(parameter.name()).matches()
                    || parameter.type() == null || !TYPES.contains(parameter.type()) || !seen.add(parameter.name().toLowerCase(Locale.ROOT))
                    || Set.of("pattern", "patternProperties").contains(parameter.name())
                    || (parameter.sample() != null && parameter.sample().length() > 4096)) {
                throw new IllegalArgumentException("Invalid query parameter");
            }
        }
        if (seen.size() > 100) throw new IllegalArgumentException("Too many query parameters");
    }

    private static List<Parameter> parameters(Content content) {
        return content.parameters() == null ? List.of() : content.parameters();
    }

    private static ObjectNode property(String type) {
        ObjectNode property = JSON.createObjectNode();
        ArrayNode types = property.putArray(TYPE).add("null");
        switch (type) {
            case "INT64" -> types.add("integer").add("string");
            case "FLOAT64" -> types.add("number");
            case "NUMERIC", "BIGNUMERIC" -> types.add("number").add("string");
            case "BOOL" -> types.add("boolean");
            case "DATE" -> { types.add("string"); property.put("format", "date"); }
            default -> types.add("string");
        }
        return property;
    }

    /** The scalar-only authoring contract cannot preserve operator-owned tenant bindings or arrays. */
    private static boolean editable(IntegrationOperation operation, JsonNode dashboard) {
        return "BIGQUERY".equals(dashboard.path("kind").asText())
                && dashboard.path("credentialScoped").asBoolean(false)
                && !dashboard.has("tenantParameter")
                && DashboardOperationPolicy.eligible(operation)
                && scalarParameters(dashboard.path(PARAMETER_TYPES));
    }

    private static boolean scalarParameters(JsonNode types) {
        if (!types.isObject() || types.size() > 100) return false;
        var entries = types.fields();
        while (entries.hasNext()) {
            var entry = entries.next();
            if (!NAME.matcher(entry.getKey()).matches() || !entry.getValue().isTextual()
                    || !TYPES.contains(entry.getValue().asText())) return false;
        }
        return true;
    }

    /** @return null for an operation that is not a BigQuery dashboard query */
    static Plan toPlan(String sourceId, IntegrationOperationRepository.Versioned version) {
        IntegrationOperation operation = version.operation();
        JsonNode dashboard = JSON.valueToTree(operation.requestSchema() == null ? Map.of() : operation.requestSchema())
                .path(DASHBOARD);
        if (!editable(operation, dashboard)) return null;
        long bytes;
        try {
            bytes = Long.parseLong(dashboard.path("maximumBytesBilled").asText());
        } catch (NumberFormatException e) {
            return null;
        }
        JsonNode samples = dashboard.path("samples");
        List<Parameter> parameters = new ArrayList<>();
        dashboard.path(PARAMETER_TYPES).fields().forEachRemaining(entry -> parameters.add(new Parameter(
                entry.getKey(), entry.getValue().asText(),
                samples.hasNonNull(entry.getKey()) ? samples.path(entry.getKey()).asText() : null)));
        List<Column> columns = new ArrayList<>();
        dashboard.path("columns").forEach(column -> columns.add(new Column(column.path("name").asText(),
                column.path(TYPE).asText(), column.path("mode").asText("NULLABLE"))));
        return new Plan(operation.id(), sourceId, operation.name(),
                dashboard.hasNonNull("description") ? dashboard.path("description").asText() : null,
                dashboard.path("projectId").asText(), dashboard.path("location").asText(),
                dashboard.path("query").asText(), bytes, parameters, columns.isEmpty() ? null : columns,
                revisionOf(version.updatedAt()), version.updatedAt().toInstant().toString(),
                dashboard.hasNonNull("updatedBy") ? dashboard.path("updatedBy").asText() : null);
    }
}
