package com.microboxlabs.miot.integrations.email;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Calls the Resend HTTP API. Blocking; run it off the event loop. The API's address is server
 * configuration ({@code miot.integrations.resend.base-url}), never a connection's, so a stored
 * key is only ever sent to Resend.
 */
@ApplicationScoped
public class ResendClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(15);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI baseUrl;

    @Inject
    public ResendClient(ObjectMapper objectMapper,
            @ConfigProperty(name = "miot.integrations.resend.base-url", defaultValue = "https://api.resend.com")
            URI baseUrl) {
        this.httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl;
    }

    public URI baseUrl() {
        return baseUrl;
    }

    /** Whether a connection's base URL names this client's Resend API (unset counts). */
    public boolean serves(URI connectionBaseUrl) {
        return connectionBaseUrl == null || trim(connectionBaseUrl.toString()).equals(trim(baseUrl.toString()));
    }

    /**
     * {@code POST /emails}. Resend keeps an {@code idempotencyKey} for 24 hours, so a retry with
     * the same key does not send twice.
     */
    public SendResult send(String apiKey, EmailMessage message, String idempotencyKey) {
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
        HttpRequest.Builder request = HttpRequest.newBuilder(endpoint("/emails"))
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
    public HttpResponse<String> listDomains(String apiKey) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(endpoint("/domains"))
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

    private URI endpoint(String path) {
        return URI.create(trim(baseUrl.toString()) + path);
    }

    private static String trim(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
