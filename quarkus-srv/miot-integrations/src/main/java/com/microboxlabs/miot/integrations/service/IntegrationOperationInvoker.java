package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.jobs.JobHttpTrace;
import com.microboxlabs.miot.integrations.net.OutboundUrlGuard;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Executes a stored {@link IntegrationOperation} against its connection.
 *
 * <p>This is the piece the module was missing. {@code integration_operations} has always
 * been a catalog — a method, a path and a schema that nothing ever called — so every
 * outbound integration (calendar, WhatsApp, Gauss) had to ship its own hand-rolled client
 * repeating the same URL joining, auth and error mapping. Anything with a connection and an
 * operation can now be called without new code:
 *
 * <pre>{@code
 * OperationInvocationResult result =
 *         invoker.invoke(tenantCode, connectionId, operationId, Map.of("field", "value"));
 * }</pre>
 *
 * <p><b>Blocking.</b> Uses the JDK client on the calling thread, matching every other
 * outbound client in this module; call it from a worker thread (async-job handlers already
 * are) and never from the event loop.
 *
 * <p><b>Not a status check.</b> The invoker calls whatever connection it is given, including
 * a {@code DRAFT} one — a test probe legitimately needs that. Callers that require an
 * {@code ACTIVE} connection must assert it themselves.
 */
@ApplicationScoped
public class IntegrationOperationInvoker {

    /** Methods that carry a request body; anything else is sent without one. */
    private static final Set<String> BODY_METHODS = Set.of("POST", "PUT", "PATCH");

    /** What a credential-bearing value becomes in the recorded request. */
    private static final String REDACTED = "<redacted>";

    private final IntegrationConnectionResolver connectionResolver;
    private final IntegrationOperationRepository operationRepository;
    private final CredentialAuthRegistry authRegistry;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Duration timeout;

    @Inject
    public IntegrationOperationInvoker(
            IntegrationConnectionResolver connectionResolver,
            IntegrationOperationRepository operationRepository,
            CredentialAuthRegistry authRegistry,
            @ConfigProperty(name = "miot.integrations.operation-invoker.timeout-seconds", defaultValue = "20")
            int timeoutSeconds) {
        this(connectionResolver, operationRepository, authRegistry,
                HttpClient.newHttpClient(), new ObjectMapper(), Duration.ofSeconds(timeoutSeconds));
    }

    IntegrationOperationInvoker(
            IntegrationConnectionResolver connectionResolver,
            IntegrationOperationRepository operationRepository,
            CredentialAuthRegistry authRegistry,
            HttpClient httpClient,
            ObjectMapper objectMapper,
            Duration timeout) {
        this.connectionResolver = connectionResolver;
        this.operationRepository = operationRepository;
        this.authRegistry = authRegistry;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.timeout = timeout;
    }

    /**
     * @param body sent as a JSON body on POST/PUT/PATCH ({@code Map} → object, {@code List} →
     *        array); ignored for other methods
     * @throws OperationInvocationException when the operation is unknown to the connection,
     *         the credential is unusable, the URL is not a public HTTP(S) one, or the call
     *         never completed
     */
    public OperationInvocationResult invoke(
            String tenantCode, String connectionId, String operationId, Object body) {
        ResolvedConnection connection = connectionResolver.resolve(tenantCode, connectionId);
        IntegrationOperation operation =
                operationRepository.findByConnectionAndId(connectionId, operationId);
        if (operation == null) {
            throw new OperationInvocationException(
                    "Operation " + operationId + " does not belong to connection " + connectionId);
        }
        return execute(connection, operation, body);
    }

    /** As {@link #invoke}, addressing the operation by its (case-insensitive) name. */
    public OperationInvocationResult invokeByName(
            String tenantCode, String connectionId, String operationName, Map<String, Object> body) {
        ResolvedConnection connection = connectionResolver.resolve(tenantCode, connectionId);
        IntegrationOperation operation =
                operationRepository.findByConnectionAndName(connectionId, operationName);
        if (operation == null) {
            throw new OperationInvocationException(
                    "Connection " + connectionId + " has no operation named '" + operationName + "'");
        }
        return execute(connection, operation, body);
    }

    OperationInvocationResult execute(
            ResolvedConnection connection, IntegrationOperation operation, Object body) {
        ResolvedAuth auth = resolveAuth(connection);
        String method = method(operation);
        String requestBody = BODY_METHODS.contains(method) ? serialize(body) : null;
        URI url = buildUrl(connection.baseUrl(), operation.path(), auth.queryParams());

        // The request as it will be recorded for the audit trail: the same call, with every
        // credential masked — auth header values, and any auth query params folded into the
        // URL. Computed up front so it is recorded on every outcome below, including a failure
        // that happens before the request leaves the process (the SSRF guard rejecting an
        // unresolvable or internal host) — the case that previously recorded nothing at all.
        Map<String, String> recordedHeaders = recordedRequestHeaders(auth.headers(), requestBody != null);
        String recordedUrl = auth.queryParams().isEmpty()
                ? url.toString()
                : buildUrl(connection.baseUrl(), operation.path(), maskValues(auth.queryParams())).toString();

        long startedAt = System.nanoTime();
        try {
            // Resolves the host: a stored base URL is operator input and could point at the
            // cluster's own metadata service or a private address.
            OutboundUrlGuard.requirePublicHttpUrl(url, "connection base URL");

            HttpRequest.Builder builder = HttpRequest.newBuilder(url).timeout(timeout);
            auth.headers().forEach(builder::header);
            if (requestBody != null) {
                builder.header("Content-Type", "application/json");
                builder.method(method, HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8));
            } else {
                builder.method(method, HttpRequest.BodyPublishers.noBody());
            }
            builder.header("Accept", "application/json");

            HttpResponse<String> response =
                    httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            trace(method, recordedUrl, recordedHeaders, response.statusCode(), startedAt,
                    requestBody, response.body(), null);
            return new OperationInvocationResult(response.statusCode(), response.body());
        } catch (IOException e) {
            trace(method, recordedUrl, recordedHeaders, null, startedAt, requestBody, null, e.toString());
            throw new OperationInvocationException(
                    "Call to " + operation.name() + " failed: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            trace(method, recordedUrl, recordedHeaders, null, startedAt, requestBody, null, e.toString());
            throw new OperationInvocationException("Call to " + operation.name() + " was interrupted", e);
        } catch (RuntimeException e) {
            // A failure before the request left the process — the SSRF guard rejecting an
            // unresolvable or internal host. Record the intended request (nothing else would
            // have) and rethrow unchanged so the worker's outcome classification is untouched.
            trace(method, recordedUrl, recordedHeaders, null, startedAt, requestBody, null, e.getMessage());
            throw e;
        }
    }

    private ResolvedAuth resolveAuth(ResolvedConnection connection) {
        if (!connection.hasAuth()) {
            // No credential attached — legal for an endpoint that needs none.
            return new ResolvedAuth(Map.of(), Map.of(), null);
        }
        try {
            return authRegistry.resolve(connection.authContext());
        } catch (AuthResolutionException e) {
            throw new OperationInvocationException(
                    "Could not authenticate connection " + connection.connectionId() + ": " + e.getMessage(), e);
        }
    }

    /**
     * Joins the connection's base URL with the operation's path, then appends any auth
     * query parameters. Tolerates a trailing slash on the base and a missing leading slash
     * on the path, and preserves a query string the path already carries.
     */
    static URI buildUrl(URI baseUrl, String path, Map<String, String> queryParams) {
        if (baseUrl == null) {
            throw new OperationInvocationException("The connection has no base URL");
        }
        String base = baseUrl.toString();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String suffix = path == null ? "" : path.trim();
        if (!suffix.isEmpty() && !suffix.startsWith("/")) {
            suffix = "/" + suffix;
        }
        StringBuilder url = new StringBuilder(base).append(suffix);

        if (queryParams != null && !queryParams.isEmpty()) {
            boolean hasQuery = url.indexOf("?") >= 0;
            for (Map.Entry<String, String> param : queryParams.entrySet()) {
                url.append(hasQuery ? '&' : '?')
                        .append(URLEncoder.encode(param.getKey(), StandardCharsets.UTF_8))
                        .append('=')
                        .append(URLEncoder.encode(param.getValue(), StandardCharsets.UTF_8));
                hasQuery = true;
            }
        }
        try {
            return URI.create(url.toString());
        } catch (IllegalArgumentException e) {
            throw new OperationInvocationException("Operation URL is not valid: " + url, e);
        }
    }

    private static String method(IntegrationOperation operation) {
        String method = operation.method() == null ? "" : operation.method().trim().toUpperCase();
        if (method.isEmpty()) {
            throw new OperationInvocationException(
                    "Operation " + operation.name() + " has no HTTP method");
        }
        return method;
    }

    private String serialize(Object body) {
        try {
            return objectMapper.writeValueAsString(body == null ? Map.of() : body);
        } catch (JsonProcessingException e) {
            throw new OperationInvocationException("Request body could not be serialized", e);
        }
    }

    private static void trace(String method, String url, Map<String, String> requestHeaders,
                              Integer status, long startedAt, String requestBody, String responseBody,
                              String error) {
        long durationMs = (System.nanoTime() - startedAt) / 1_000_000;
        // Headers are pre-redacted by recordedRequestHeaders — no secret reaches the trace.
        JobHttpTrace.record(method, url, status, durationMs, requestBody, responseBody, error, requestHeaders);
    }

    /**
     * The request's headers as recorded for the audit trail: the transport headers we add
     * ({@code Accept}, and {@code Content-Type} when there is a body) in the clear, and every
     * auth-derived header masked. Its value is a bearer token or API key, and only here — where
     * the header came from the resolved credential rather than the protocol — is that knowable;
     * an operator-named API-key header could otherwise pass any name-based filter downstream.
     */
    static Map<String, String> recordedRequestHeaders(Map<String, String> authHeaders, boolean hasBody) {
        Map<String, String> headers = new LinkedHashMap<>();
        authHeaders.forEach((name, value) -> headers.put(name, REDACTED));
        if (hasBody) {
            headers.put("Content-Type", "application/json");
        }
        headers.put("Accept", "application/json");
        return headers;
    }

    /** Same keys, every value masked — so a URL whose query string carries auth secrets can be
     *  recorded without leaking them. */
    static Map<String, String> maskValues(Map<String, String> params) {
        Map<String, String> masked = new LinkedHashMap<>();
        params.forEach((name, value) -> masked.put(name, REDACTED));
        return masked;
    }
}
