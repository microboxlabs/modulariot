package com.microboxlabs.miot.gateway.fork;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.gateway.fork.config.ForkConfig;
import com.microboxlabs.miot.gateway.fork.model.BodyParserType;
import com.microboxlabs.miot.gateway.fork.model.ForkResult;
import com.microboxlabs.miot.gateway.fork.model.ForkRule;
import com.microboxlabs.miot.gateway.fork.model.ForkTarget;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MultivaluedMap;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.jboss.logging.Logger;

/**
 * Core fork routing engine.
 *
 * <p>At startup, builds an index of path → rules from config, registers filters
 * in {@link ForkFilterRegistry}, pre-builds all Micrometer meters, and creates a
 * shared {@link HttpClient}.
 *
 * <p>At request time ({@link #process}):
 * <ol>
 *   <li>Extract the routing key from the body using the rule's body parser
 *   <li>Check the key against the in-memory filter
 *   <li>Fan out to all rule targets asynchronously (fire-and-forget)
 * </ol>
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.gateway.enabled", stringValue = "true")
public class ForkEngine {

    private static final Logger LOG = Logger.getLogger(ForkEngine.class);

    private static final String METRIC_FORK_REQUESTS = "fork_requests_total";
    private static final String TAG_OUTCOME = "outcome";
    private static final String TAG_TARGET = "target";

    /**
     * HTTP headers that must not be forwarded to upstream targets.
     * Covers hop-by-hop headers and Java HttpClient restricted headers.
     */
    private static final Set<String> SKIP_HEADERS = Set.of(
            "host", "content-length", "transfer-encoding", "connection",
            "upgrade", "keep-alive", "proxy-connection", "te", "trailer",
            "date", "expect", "from", "via", "warning");

    private final ForkConfig config;
    private final ForkFilterRegistry filterRegistry;
    private final MeterRegistry meterRegistry;
    private final ObjectMapper objectMapper;

    private List<ForkRule> rules = List.of();
    private Map<String, List<ForkRule>> pathIndex = Map.of();
    private HttpClient httpClient;

    // Pre-built meters keyed by "ruleId" or "ruleId:targetId"
    private final Map<String, Counter> discardedCounters = new HashMap<>();
    private final Map<String, Counter> forwardedCounters = new HashMap<>();
    private final Map<String, Counter> errorCounters = new HashMap<>();
    private final Map<String, Timer> forwardTimers = new HashMap<>();

    ForkEngine(ForkConfig config, ForkFilterRegistry filterRegistry,
            MeterRegistry meterRegistry, ObjectMapper objectMapper) {
        this.config = config;
        this.filterRegistry = filterRegistry;
        this.meterRegistry = meterRegistry;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void init() {
        if (!config.enabled()) {
            LOG.info("Fork engine disabled (fork.enabled=false) — no rules loaded");
            return;
        }

        List<ForkConfig.RuleConfig> ruleConfigs = config.rules();
        if (ruleConfigs == null || ruleConfigs.isEmpty()) {
            LOG.info("Fork engine enabled but no rules configured");
            return;
        }

        rules = ruleConfigs.stream()
                .filter(ForkConfig.RuleConfig::enabled)
                .map(this::buildRule)
                .toList();

        // Build path index: path → [rules that match it]
        Map<String, List<ForkRule>> index = new HashMap<>();
        for (ForkRule rule : rules) {
            for (String path : rule.paths()) {
                index.computeIfAbsent(path, k -> new ArrayList<>()).add(rule);
            }
        }
        pathIndex = Collections.unmodifiableMap(index);

        // Register each rule's filter (loads file if configured)
        rules.forEach(filterRegistry::register);

        // Shared HTTP client — connection pooling handled internally
        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        // Pre-build all Micrometer meters (avoids lookup overhead on hot path)
        for (ForkRule rule : rules) {
            discardedCounters.put(rule.id(),
                    meterRegistry.counter(METRIC_FORK_REQUESTS,
                            "rule", rule.id(), TAG_TARGET, "-", TAG_OUTCOME, "discarded"));

            for (ForkTarget target : rule.targets()) {
                String key = rule.id() + ":" + target.id();
                forwardedCounters.put(key,
                        meterRegistry.counter(METRIC_FORK_REQUESTS,
                                "rule", rule.id(), TAG_TARGET, target.id(), TAG_OUTCOME, "forwarded"));
                errorCounters.put(key,
                        meterRegistry.counter(METRIC_FORK_REQUESTS,
                                "rule", rule.id(), TAG_TARGET, target.id(), TAG_OUTCOME, "error"));
                forwardTimers.put(key,
                        meterRegistry.timer("fork_forward_duration_seconds",
                                "rule", rule.id(), TAG_TARGET, target.id()));
            }
        }

        LOG.infof("Fork engine ready — %d rule(s) across %d path(s):", rules.size(), pathIndex.size());
        pathIndex.forEach((path, rs) ->
                LOG.infof("  %s → [%s]", path,
                        rs.stream().map(ForkRule::id).collect(Collectors.joining(", "))));
    }

    // -------------------------------------------------------------------------
    // Request handling (called by ForkMirrorResource on every mirrored request)
    // -------------------------------------------------------------------------

    /**
     * Returns the rules that should handle an incoming request to {@code path}.
     * Returns an empty list if no rules match — the caller should return 200 immediately.
     */
    public List<ForkRule> findRulesForPath(String path) {
        return pathIndex.getOrDefault(path, List.of());
    }

    /**
     * Extracts the routing key, checks the filter, and fans out to all targets.
     * Always completes synchronously (the actual HTTP calls are fire-and-forget).
     *
     * @return a {@link ForkResult} describing what happened — forwarded, discarded, or error.
     *         The caller may attach this to response headers for traceability.
     */
    public ForkResult process(ForkRule rule, String body, MultivaluedMap<String, String> headers) {
        String key;
        try {
            key = extractKey(rule, body);
        } catch (IOException e) {
            LOG.warnf(e, "Rule '%s': failed to extract key field '%s' — discarding", rule.id(), rule.keyField());
            discardedCounters.get(rule.id()).increment();
            return ForkResult.error(rule.id(), null);
        }

        if (key == null || key.isBlank()) {
            LOG.debugf("Rule '%s': key field '%s' is absent or empty — discarding", rule.id(), rule.keyField());
            discardedCounters.get(rule.id()).increment();
            return ForkResult.discarded(rule.id(), key);
        }

        if (!filterRegistry.contains(rule.id(), key)) {
            LOG.debugf("Rule '%s': key '%s' not in filter — discarding", rule.id(), key);
            discardedCounters.get(rule.id()).increment();
            return ForkResult.discarded(rule.id(), key);
        }

        List<String> dispatched = new ArrayList<>();
        for (ForkTarget target : rule.targets()) {
            forwardAsync(rule, target, key, body, headers);
            dispatched.add(target.id());
        }
        return ForkResult.forwarded(rule.id(), key, dispatched);
    }

    // -------------------------------------------------------------------------
    // Management API support
    // -------------------------------------------------------------------------

    public List<ForkRule> rules() {
        return rules;
    }

    public Optional<ForkRule> findRule(String id) {
        return rules.stream().filter(r -> r.id().equals(id)).findFirst();
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private void forwardAsync(ForkRule rule, ForkTarget target, String key,
            String body, MultivaluedMap<String, String> headers) {

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(target.url()))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .timeout(Duration.ofMillis(target.timeout()));

        headers.forEach((name, values) -> {
            if (!SKIP_HEADERS.contains(name.toLowerCase())) {
                values.forEach(v -> builder.header(name, v));
            }
        });
        if (!headers.containsKey("Content-Type") && !headers.containsKey("content-type")) {
            builder.header("Content-Type", contentTypeFor(rule.bodyParser()));
        }

        String metricsKey = rule.id() + ":" + target.id();
        Timer.Sample sample = Timer.start(meterRegistry);

        httpClient.sendAsync(builder.build(), HttpResponse.BodyHandlers.discarding())
                .thenAccept(resp -> {
                    sample.stop(forwardTimers.get(metricsKey));
                    forwardedCounters.get(metricsKey).increment();
                    LOG.infof("Forwarded key=%s rule=%s target=%s status=%d",
                            key, rule.id(), target.id(), resp.statusCode());
                })
                .exceptionally(ex -> {
                    errorCounters.get(metricsKey).increment();
                    LOG.errorf(ex, "Forward failed key=%s rule=%s target=%s",
                            key, rule.id(), target.id());
                    return null;
                });
    }

    private String extractKey(ForkRule rule, String body) throws IOException {
        return switch (rule.bodyParser()) {
            case JSON -> extractJsonKey(body, rule.keyField());
            case CSV -> extractCsvKey(body, rule.keyField());
        };
    }

    private String extractJsonKey(String body, String keyField) throws IOException {
        return objectMapper.readTree(body).path(keyField).asText(null);
    }

    /**
     * CSV key extraction.
     *
     * <p>If {@code keyField} is a numeric string (e.g. "0"), treats it as a
     * zero-based column index. Otherwise, reads the first line as a header row
     * and finds the column by name (case-insensitive).
     *
     * <p>Only the first data line is parsed — the body is expected to be a
     * single-record CSV row as forwarded by APISIX.
     */
    private String extractCsvKey(String body, String keyField) {
        String[] lines = body.strip().split("\\R", -1);
        if (lines.length == 0) return null;

        // Numeric field → column index
        try {
            int idx = Integer.parseInt(keyField.trim());
            String dataLine = lines.length == 1 ? lines[0] : lines[1];
            String[] cols = dataLine.split(",", -1);
            return idx < cols.length ? cols[idx].trim() : null;
        } catch (NumberFormatException ignored) {
            // Not an index — treat as column name
        }

        if (lines.length < 2) return null;

        String[] csvHeaders = lines[0].split(",", -1);
        String[] values = lines[1].split(",", -1);
        for (int i = 0; i < csvHeaders.length; i++) {
            if (csvHeaders[i].trim().equalsIgnoreCase(keyField) && i < values.length) {
                return values[i].trim();
            }
        }
        return null;
    }

    private String contentTypeFor(BodyParserType parser) {
        return switch (parser) {
            case JSON -> "application/json";
            case CSV -> "text/csv";
        };
    }

    private ForkRule buildRule(ForkConfig.RuleConfig rc) {
        List<ForkTarget> targets = rc.targets().stream()
                .map(tc -> new ForkTarget(
                        tc.id(),
                        tc.mirrorHost().replaceAll("/+$", "") + tc.mirrorPath(),
                        tc.timeout()))
                .toList();

        return new ForkRule(
                rc.id(),
                rc.enabled(),
                List.copyOf(rc.paths()),
                rc.bodyParser(),
                rc.keyField(),
                rc.filterFile(),
                targets);
    }
}
