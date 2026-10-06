package com.microboxlabs.miot.integrations.email;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Calls the Resend HTTP API. Blocking; run it off the event loop. */
@ApplicationScoped
public class ResendClient {

    public static final URI DEFAULT_BASE_URL = URI.create("https://api.resend.com");

    private static final Duration TIMEOUT = Duration.ofSeconds(15);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Inject
    public ResendClient(ObjectMapper objectMapper) {
        this(HttpClient.newBuilder().connectTimeout(TIMEOUT).build(), objectMapper);
    }

    ResendClient(HttpClient httpClient, ObjectMapper objectMapper) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    /**
     * {@code POST /emails}. Resend keeps an {@code idempotencyKey} for 24 hours, so a retry with
     * the same key does not send twice.
     */
    public SendResult send(URI baseUrl, String apiKey, EmailMessage message, String idempotencyKey) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", message.from());
        body.put("to", List.of(message.to()));
        body.put("subject", message.subject());
        body.put("text", message.text());
        if (message.html() != null) {
            body.put("html", message.html());
        }
        if (message.replyTo() != null) {
            body.put("reply_to", message.replyTo());
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            return SendResult.failed(0, "Could not build the email request");
        }
        HttpRequest.Builder request = HttpRequest.newBuilder(endpoint(baseUrl, "/emails"))
                .timeout(TIMEOUT)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json));
        if (idempotencyKey != null) {
            request.header("Idempotency-Key", idempotencyKey);
        }
        HttpResponse<String> response;
        try {
            response = httpClient.send(request.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            return SendResult.failed(0, "Could not reach Resend: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return SendResult.failed(0, "Sending was interrupted");
        }
        int status = response.statusCode();
        JsonNode answer = parse(response.body());
        if (status >= 200 && status < 300) {
            return SendResult.accepted(status, answer.path("id").asText(null));
        }
        return SendResult.failed(status, errorOf(status, answer));
    }

    /** {@code GET /domains}: proves the key is accepted. A send-only key gets 401 restricted_api_key. */
    public HttpResponse<String> listDomains(URI baseUrl, String apiKey) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(endpoint(baseUrl, "/domains"))
                .timeout(TIMEOUT)
                .header("Authorization", "Bearer " + apiKey)
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    /** Resend's error name, e.g. {@code restricted_api_key}, or null. */
    public String errorName(String body) {
        return parse(body).path("name").asText(null);
    }

    private JsonNode parse(String body) {
        try {
            return body == null || body.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(body);
        } catch (JsonProcessingException e) {
            return objectMapper.createObjectNode();
        }
    }

    private static String errorOf(int status, JsonNode answer) {
        String message = answer.path("message").asText("");
        return "Resend returned HTTP " + status + (message.isBlank() ? "" : ": " + message);
    }

    private static URI endpoint(URI baseUrl, String path) {
        String base = (baseUrl == null ? DEFAULT_BASE_URL : baseUrl).toString();
        return URI.create((base.endsWith("/") ? base.substring(0, base.length() - 1) : base) + path);
    }
}
