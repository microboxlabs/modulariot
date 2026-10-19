package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.StreamSupport;

/**
 * Reads a PostgREST connection's OpenAPI description and turns selected RPC functions into
 * read-only dashboard operations. The description is fetched with the connection's own
 * credential, through the same invoker and outbound URL policy as every other call.
 */
@ApplicationScoped
public class PostgrestCatalog {
    static final int MAX_SPEC_BYTES = 4 * 1024 * 1024;
    static final int MAX_IMPORT = 200;
    private static final int MAX_TEXT = 2048;
    private static final String SELECT = "select";
    private static final String RPC = "/rpc/";
    private static final String CONST = "const";
    private static final Pattern FUNCTION_NAME = Pattern.compile("[A-Za-z_]\\w{0,62}");
    private static final ObjectMapper JSON = new ObjectMapper();

    private final IntegrationConnectionRepository connections;
    private final IntegrationConnectionResolver resolver;
    private final IntegrationOperationRepository operations;
    private final IntegrationOperationInvoker invoker;

    public record Parameter(String name, String type, String format, boolean required) {
    }

    /** {@code operationId} is set when the function is already imported on this connection. */
    public record Function(String name, String path, String description, List<Parameter> parameters,
            String operationId) {
    }

    /** {@code pinned} fixes parameter values, e.g. a client id, or PostgREST's {@code select}. */
    public record Selection(String name, Map<String, String> pinned) {
    }

    public record ImportRequest(List<Selection> functions) {
    }

    public record ImportResult(List<IntegrationOperation> created, List<IntegrationOperation> existing) {
    }

    @Inject
    public PostgrestCatalog(IntegrationConnectionRepository connections, IntegrationConnectionResolver resolver,
            IntegrationOperationRepository operations, IntegrationOperationInvoker invoker) {
        this.connections = connections;
        this.resolver = resolver;
        this.operations = operations;
        this.invoker = invoker;
    }

    /** The raw OpenAPI answer; a non-2xx status is returned, not thrown. */
    public OperationInvocationResult fetchSpec(IntegrationConnection connection) {
        var resolved = resolver.resolve(connection.tenantCode(), connection.id());
        var root = new IntegrationOperation(null, connection.id(), "openapi", "GET", "/", Map.of(), Map.of(), false);
        return invoker.executeBounded(resolved, root, Map.of(), MAX_SPEC_BYTES);
    }

    /** Statuses of one imported function called with the connection's credential and without it. */
    public record Probe(String function, int withCredential, int withoutCredential) {
    }

    /**
     * Calls the first imported function twice, with and without the credential, sending its
     * pinned values. A PostgREST may publish its description to anyone, so only a function call
     * shows whether the credential is what grants access.
     *
     * @throws IllegalStateException when no credential is linked or no function is imported
     */
    public Probe probe(IntegrationConnection connection) {
        var resolved = resolver.resolve(connection.tenantCode(), connection.id());
        if (!resolved.hasAuth()) throw new IllegalStateException("Link a credential to this connection");
        IntegrationOperation operation = operations.listByConnection(connection.id()).stream()
                .filter(candidate -> candidate.path() != null && candidate.path().startsWith(RPC))
                .filter(DashboardOperationPolicy::eligible)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "Import at least one function in Funciones: the test calls it with and without the credential"));
        Map<String, String> parameters = pinnedValues(operation.requestSchema());
        int with = invoker.executeBounded(resolved, operation, parameters, MAX_SPEC_BYTES).status();
        var anonymous = new ResolvedConnection(resolved.connectionId(), resolved.baseUrl(), resolved.metadata(), Map.of());
        int without = invoker.executeBounded(anonymous, operation, parameters, MAX_SPEC_BYTES).status();
        return new Probe(operation.name(), with, without);
    }

    /** The values an operation's schema fixes with {@code const}. */
    static Map<String, String> pinnedValues(Map<String, Object> requestSchema) {
        Map<String, String> values = new TreeMap<>();
        if (requestSchema != null && requestSchema.get("properties") instanceof Map<?, ?> properties) {
            properties.forEach((name, property) -> {
                if (property instanceof Map<?, ?> definition && definition.get(CONST) != null) {
                    values.put(String.valueOf(name), String.valueOf(definition.get(CONST)));
                }
            });
        }
        return values;
    }

    /** RPC functions the connection exposes, by name. */
    public List<Function> functions(String tenantCode, String connectionId) {
        IntegrationConnection connection = postgrest(tenantCode, connectionId);
        Map<String, String> imported = new LinkedHashMap<>();
        for (IntegrationOperation operation : operations.listByConnection(connectionId)) {
            imported.putIfAbsent(operation.path(), operation.id());
        }
        return parse(spec(connection)).values().stream()
                .map(f -> new Function(f.name(), f.path(), f.description(), f.parameters(), imported.get(f.path())))
                .toList();
    }

    /** Creates one operation per selected function; functions already imported are returned as existing. */
    public ImportResult importFunctions(String tenantCode, String connectionId, ImportRequest request) {
        requireSelection(request);
        IntegrationConnection connection = postgrest(tenantCode, connectionId);
        Map<String, Function> available = parse(spec(connection));
        Map<String, IntegrationOperation> byPath = new LinkedHashMap<>();
        for (IntegrationOperation operation : operations.listByConnection(connectionId)) {
            byPath.putIfAbsent(operation.path(), operation);
        }
        List<IntegrationOperation> created = new ArrayList<>();
        List<IntegrationOperation> existing = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Selection selection : request.functions()) {
            Function function = selected(available, selection);
            IntegrationOperation current = byPath.get(function.path());
            if (seen.add(function.name()) && current == null) {
                created.add(operations.create(new IntegrationOperation(UUID.randomUUID().toString(), connectionId,
                        function.name(), "GET", function.path(), requestSchema(function, selection.pinned()),
                        Map.of(), false)));
            } else if (current != null && !existing.contains(current)) {
                existing.add(current);
            }
        }
        return new ImportResult(created, existing);
    }

    private static void requireSelection(ImportRequest request) {
        if (request == null || request.functions() == null || request.functions().isEmpty()
                || request.functions().size() > MAX_IMPORT) {
            throw new IllegalArgumentException("Select between 1 and " + MAX_IMPORT + " functions");
        }
    }

    private static Function selected(Map<String, Function> available, Selection selection) {
        String name = selection == null ? null : selection.name();
        Function function = name == null ? null : available.get(name);
        if (function == null) throw new IllegalArgumentException("Unknown function: " + name);
        return function;
    }

    static Map<String, Object> requestSchema(Function function, Map<String, String> pinned) {
        Map<String, String> pins = pinned == null ? Map.of() : pinned;
        Set<String> names = new HashSet<>();
        function.parameters().forEach(p -> names.add(p.name()));
        Map<String, Object> properties = new TreeMap<>();
        for (Parameter parameter : function.parameters()) {
            properties.put(parameter.name(), Map.of("type", "string", "maxLength", MAX_TEXT));
        }
        List<String> required = new ArrayList<>();
        for (var pin : new TreeMap<>(pins).entrySet()) {
            if (!names.contains(pin.getKey()) && !SELECT.equals(pin.getKey())) {
                throw new IllegalArgumentException(function.name() + " has no parameter " + pin.getKey());
            }
            String value = pin.getValue();
            if (value == null || value.isBlank() || value.length() > MAX_TEXT) {
                throw new IllegalArgumentException("Pinned value for " + pin.getKey() + " must be 1-" + MAX_TEXT + " characters");
            }
            properties.put(pin.getKey(), Map.of("type", "string", CONST, value));
            required.add(pin.getKey());
        }
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("additionalProperties", false);
        schema.put("properties", properties);
        if (!required.isEmpty()) schema.put("required", required);
        schema.put("x-dashboard", Map.of("readOnly", true, "kind", "HTTP_GET", "credentialScoped", true));
        return schema;
    }

    /** Functions under {@code /rpc/} that accept GET, keyed by name. Only query parameters are kept. */
    static Map<String, Function> parse(JsonNode spec) {
        JsonNode paths = spec.path("paths");
        if (!paths.isObject()) throw new OperationInvocationException("The PostgREST description has no paths");
        Map<String, Function> functions = new TreeMap<>();
        paths.fields().forEachRemaining(entry -> {
            String path = entry.getKey();
            if (!path.startsWith(RPC)) return;
            String name = path.substring(RPC.length());
            JsonNode get = entry.getValue().path("get");
            if (!FUNCTION_NAME.matcher(name).matches() || !get.isObject()) return;
            List<Parameter> parameters = StreamSupport.stream(get.path("parameters").spliterator(), false)
                    .filter(PostgrestCatalog::isQueryParameter)
                    .map(parameter -> new Parameter(parameter.path("name").asText(),
                            parameter.path("type").asText(null), parameter.path("format").asText(null),
                            parameter.path("required").asBoolean(false)))
                    .toList();
            String description = get.path("summary").asText(get.path("description").asText(null));
            functions.put(name, new Function(name, path, description, List.copyOf(parameters), null));
        });
        return functions;
    }

    private static boolean isQueryParameter(JsonNode parameter) {
        return "query".equals(parameter.path("in").asText()) && parameter.hasNonNull("name")
                && FUNCTION_NAME.matcher(parameter.path("name").asText()).matches();
    }

    private JsonNode spec(IntegrationConnection connection) {
        OperationInvocationResult result = fetchSpec(connection);
        if (!result.successful()) {
            throw new OperationInvocationException("PostgREST answered HTTP " + result.status());
        }
        try {
            return JSON.readTree(result.body());
        } catch (IOException e) {
            throw new OperationInvocationException("PostgREST did not return a JSON description");
        }
    }

    private IntegrationConnection postgrest(String tenantCode, String connectionId) {
        IntegrationConnection connection = connections.findByTenantAndId(tenantCode, connectionId);
        if (connection == null) throw new ConnectionResolutionException("Connection not found");
        if (connection.providerType() != ProviderType.POSTGREST) {
            throw new IllegalArgumentException("Only POSTGREST connections describe functions");
        }
        return connection;
    }
}
