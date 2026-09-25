package com.microboxlabs.miot.integrations.selectable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectableOptionSource;
import com.microboxlabs.miot.core.selectable.SelectableSource;
import com.microboxlabs.miot.core.selectable.SourceUnavailableException;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.service.IntegrationOperationInvoker;
import com.microboxlabs.miot.integrations.service.OperationInvocationException;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Options read from one of the organization's connections: a list names a
 * connection and one of its GET operations ({@code connectionId:operationId}),
 * and its config says where the items are and which fields to show.
 *
 * <p>Only ACTIVE connections and GET operations are offered, because a field
 * calls the operation as the user types. The answer is kept for {@link #KEEP},
 * so typing filters it here instead of calling the provider again. With no
 * {@code items} path, the items are the response itself when it is an array,
 * else the first of {@code data}, {@code items} or {@code results} that is.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class ConnectionOptionSource implements SelectableOptionSource {

    static final Duration KEEP = Duration.ofMinutes(1);
    private static final String SEPARATOR = ":";
    private static final List<String> USUAL_ITEMS = List.of("data", "items", "results");

    private final IntegrationConnectionRepository connections;
    private final IntegrationOperationRepository operations;
    private final IntegrationOperationInvoker invoker;
    private final ObjectMapper json = new ObjectMapper();
    private final Clock clock;
    private final Map<String, Answer> answers = new ConcurrentHashMap<>();

    private record Answer(List<SelectableOption> options, Instant until) {
    }

    @Inject
    public ConnectionOptionSource(IntegrationConnectionRepository connections,
            IntegrationOperationRepository operations, IntegrationOperationInvoker invoker) {
        this(connections, operations, invoker, Clock.systemUTC());
    }

    ConnectionOptionSource(IntegrationConnectionRepository connections, IntegrationOperationRepository operations,
            IntegrationOperationInvoker invoker, Clock clock) {
        this.connections = connections;
        this.operations = operations;
        this.invoker = invoker;
        this.clock = clock;
    }

    @Override
    public SelectableSource.Kind kind() {
        return SelectableSource.Kind.CONNECTION;
    }

    @Override
    public String id() {
        return "connection";
    }

    @Override
    public List<Descriptor> describe(String tenantCode) {
        List<Descriptor> out = new ArrayList<>();
        for (IntegrationConnection c : connections.listByTenant(tenantCode)) {
            if (c.status() != ConnectionStatus.ACTIVE) {
                continue;
            }
            for (IntegrationOperation op : operations.listByConnection(c.id())) {
                if (isGet(op)) {
                    String label = c.name() + " › " + op.name();
                    String path = "GET " + (op.path() == null ? "/" : op.path());
                    out.add(new Descriptor(SelectableSource.Kind.CONNECTION, c.id() + SEPARATOR + op.id(),
                            Map.of("es", label, "en", label), Map.of("es", path, "en", path)));
                }
            }
        }
        return out;
    }

    @Override
    public List<SelectableOption> options(String tenantCode, SelectableSource source, Query query) {
        String needle = fold(query.search());
        return all(tenantCode, source).stream()
                .filter(o -> query.parents().isEmpty() || o.parent() != null && query.parents().contains(o.parent()))
                .filter(o -> needle.isEmpty() || matches(o, needle))
                .limit(query.limit())
                .toList();
    }

    private List<SelectableOption> all(String tenantCode, SelectableSource source) {
        String cacheKey = tenantCode + "|" + source.ref() + "|" + source.config();
        Instant now = clock.instant();
        Answer kept = answers.get(cacheKey);
        if (kept != null && now.isBefore(kept.until())) {
            return kept.options();
        }
        List<SelectableOption> options = fetch(tenantCode, source);
        answers.put(cacheKey, new Answer(options, now.plus(KEEP)));
        return options;
    }

    private List<SelectableOption> fetch(String tenantCode, SelectableSource source) {
        String[] ref = source.ref() == null ? new String[0] : source.ref().split(SEPARATOR, 2);
        if (ref.length != 2) {
            throw new IllegalArgumentException("a connection source ref is connectionId:operationId");
        }
        IntegrationConnection connection = connections.findByTenantAndId(tenantCode, ref[0]);
        if (connection == null || connection.status() != ConnectionStatus.ACTIVE) {
            throw new IllegalArgumentException("no active connection " + ref[0]);
        }
        IntegrationOperation operation = operations.findByConnectionAndId(ref[0], ref[1]);
        if (operation == null || !isGet(operation)) {
            throw new IllegalArgumentException("no GET operation " + ref[1] + " on connection " + ref[0]);
        }
        OperationInvocationResult result;
        try {
            result = invoker.invoke(tenantCode, ref[0], ref[1], null);
        } catch (OperationInvocationException e) {
            throw new SourceUnavailableException(connection.name() + " could not be called: " + e.getMessage(), e);
        }
        if (!result.successful()) {
            throw new SourceUnavailableException(connection.name() + " answered " + result.summary());
        }
        return toOptions(result.body(), new Mapping(source.config()));
    }

    /** Which parts of the answer become options. */
    record Mapping(String items, String value, String label, String parent) {

        Mapping(Map<String, Object> config) {
            this(text(config, "items", ""), text(config, "value", "id"), text(config, "label", "name"),
                    text(config, "parent", ""));
        }

        private static String text(Map<String, Object> config, String key, String fallback) {
            Object v = config == null ? null : config.get(key);
            return v == null || v.toString().isBlank() ? fallback : v.toString().trim();
        }
    }

    List<SelectableOption> toOptions(String body, Mapping mapping) {
        JsonNode root;
        try {
            root = json.readTree(body == null ? "" : body);
        } catch (IOException e) {
            throw new SourceUnavailableException("the answer is not JSON", e);
        }
        JsonNode items = items(root, mapping.items());
        if (items == null || !items.isArray()) {
            throw new SourceUnavailableException("no list of items at '" + mapping.items() + "' in the answer");
        }
        List<SelectableOption> out = new ArrayList<>();
        for (JsonNode item : items) {
            String value = at(item, mapping.value());
            if (value == null) {
                continue;
            }
            String label = at(item, mapping.label());
            String text = label == null ? value : label;
            SelectableOption option = SelectableOption.of(value, text, text);
            String parent = mapping.parent().isEmpty() ? null : at(item, mapping.parent());
            out.add(parent == null ? option : option.withParent(parent));
        }
        return out;
    }

    private static JsonNode items(JsonNode root, String path) {
        if (!path.isEmpty()) {
            return node(root, path);
        }
        if (root.isArray()) {
            return root;
        }
        return USUAL_ITEMS.stream().map(root::path).filter(JsonNode::isArray).findFirst().orElse(null);
    }

    /** The node at a dot path such as {@code data.items}. */
    private static JsonNode node(JsonNode from, String path) {
        JsonNode node = from;
        for (String part : path.split("\\.")) {
            node = node.path(part);
        }
        return node.isMissingNode() || node.isNull() ? null : node;
    }

    /** The text at a dot path, when it is a scalar. */
    private static String at(JsonNode item, String path) {
        JsonNode node = node(item, path);
        if (node == null || node.isContainerNode()) {
            return null;
        }
        String text = node.asText().trim();
        return text.isEmpty() ? null : text;
    }

    private static boolean isGet(IntegrationOperation op) {
        return op.method() != null && "GET".equalsIgnoreCase(op.method().trim());
    }

    private static boolean matches(SelectableOption o, String needle) {
        return fold(o.value()).contains(needle)
                || o.label().values().stream().anyMatch(text -> fold(text).contains(needle));
    }

    private static String fold(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        return Normalizer.normalize(text.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }
}
