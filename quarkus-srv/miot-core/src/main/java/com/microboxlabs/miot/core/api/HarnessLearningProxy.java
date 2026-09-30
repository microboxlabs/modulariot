package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.http.RequestOptions;
import io.vertx.core.json.DecodeException;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.core.buffer.Buffer;
import io.vertx.mutiny.core.http.HttpClient;
import io.vertx.mutiny.core.http.HttpClientResponse;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

/**
 * Forwards the trainer's knowledge and learning calls to the harness with the
 * organization's tenant set by the modulith, never by the caller: any
 * {@code tenant_id} in the query or an evaluation body is replaced, and
 * knowledge writes carry the caller's email as {@code author}.
 *
 * <p>Harness 4xx answers pass through; a 5xx, a timeout or an unreachable
 * harness become 502.
 */
final class HarnessLearningProxy {

    static final String KNOWLEDGE = "knowledge";
    static final String LEARNING = "learning";
    static final String TENANT_ID = "tenant_id";
    static final String AUTHOR = "author";

    /** Who is calling, as forwarded to the harness in the {@code X-Miot-*} headers. */
    record Caller(String authorization, String tenantClientId, String userEmail, String authMode) {
    }

    private final HttpClient client;
    private final String baseUrl;
    private final Duration timeout;

    HarnessLearningProxy(HttpClient client, String baseUrl, Duration timeout) {
        this.client = client;
        this.baseUrl = baseUrl;
        this.timeout = timeout;
    }

    Uni<Response> forward(HttpMethod method,
                          String area,
                          String path,
                          MultivaluedMap<String, String> query,
                          String body,
                          Caller caller) {
        if (caller.tenantClientId() == null || caller.tenantClientId().isBlank()) {
            return Uni.createFrom().item(error(Response.Status.FORBIDDEN, "organization has no tenant"));
        }
        String encodedPath = encodePath(path);
        if (encodedPath == null) {
            return Uni.createFrom().item(error(Response.Status.BAD_REQUEST, "invalid path"));
        }
        boolean knowledgeWrite = KNOWLEDGE.equals(area) && method != HttpMethod.GET;
        String uri = baseUrl + "/" + area + "/" + encodedPath
                + queryString(query, caller, knowledgeWrite && method == HttpMethod.DELETE);
        String outBody = requestBody(method, area, body, caller, knowledgeWrite);

        RequestOptions options = new RequestOptions()
                .setMethod(method)
                .setAbsoluteURI(uri)
                .setIdleTimeout(timeout.toMillis());
        return client.request(options)
                .flatMap(req -> {
                    if (caller.authorization() != null) {
                        req.putHeader("Authorization", caller.authorization());
                    }
                    req.putHeader("X-Miot-Tenant-Client-Id", caller.tenantClientId());
                    if (caller.userEmail() != null) {
                        req.putHeader("X-Miot-User-Email", caller.userEmail());
                    }
                    req.putHeader("X-Miot-Auth-Mode", caller.authMode());
                    if (outBody == null) {
                        return req.send();
                    }
                    req.putHeader("Content-Type", MediaType.APPLICATION_JSON);
                    return req.send(outBody);
                })
                .flatMap(resp -> resp.body().map(buffer -> toResponse(resp, buffer)))
                .onFailure().recoverWithItem(err ->
                        error(Response.Status.BAD_GATEWAY, "harness unavailable"));
    }

    private static Response toResponse(HttpClientResponse resp, Buffer body) {
        int status = resp.statusCode();
        if (status >= 500) {
            return error(Response.Status.BAD_GATEWAY, "harness error (" + status + ")");
        }
        Response.ResponseBuilder out = Response.status(status);
        if (body != null && body.length() > 0) {
            String contentType = resp.getHeader("Content-Type");
            out.type(contentType != null ? contentType : MediaType.APPLICATION_JSON)
                    .entity(body.toString());
        }
        return out.build();
    }

    /**
     * Re-encodes the decoded path one segment at a time. A dot segment would let
     * the harness normalize the request out of its area, so it is refused.
     */
    static String encodePath(String path) {
        if (path == null || path.isBlank()) {
            return null;
        }
        StringJoiner out = new StringJoiner("/");
        for (String segment : path.split("/", -1)) {
            if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) {
                return null;
            }
            out.add(encode(segment));
        }
        return out.toString();
    }

    private static String queryString(
            MultivaluedMap<String, String> query, Caller caller, boolean setAuthor) {
        StringJoiner out = new StringJoiner("&", "?", "");
        if (query != null) {
            for (Map.Entry<String, List<String>> entry : query.entrySet()) {
                String name = entry.getKey();
                if (TENANT_ID.equals(name) || (setAuthor && AUTHOR.equals(name))) {
                    continue;
                }
                for (String value : entry.getValue()) {
                    out.add(encode(name) + "=" + encode(value));
                }
            }
        }
        out.add(TENANT_ID + "=" + encode(caller.tenantClientId()));
        if (setAuthor && caller.userEmail() != null) {
            out.add(AUTHOR + "=" + encode(caller.userEmail()));
        }
        return out.toString();
    }

    private static String requestBody(
            HttpMethod method, String area, String body, Caller caller, boolean knowledgeWrite) {
        if (method == HttpMethod.GET || method == HttpMethod.DELETE) {
            return null;
        }
        if (body == null || body.isBlank()) {
            return LEARNING.equals(area)
                    ? new JsonObject().put(TENANT_ID, caller.tenantClientId()).encode()
                    : null;
        }
        JsonObject json;
        try {
            json = new JsonObject(body);
        } catch (DecodeException | ClassCastException e) {
            // Not an object: the harness answers it with its own validation error.
            return body;
        }
        if (LEARNING.equals(area)) {
            json.put(TENANT_ID, caller.tenantClientId());
        }
        if (knowledgeWrite && caller.userEmail() != null) {
            json.put(AUTHOR, caller.userEmail());
        }
        return json.encode();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    static Response error(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", message))
                .build();
    }
}
