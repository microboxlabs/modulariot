package com.microboxlabs.miot.conversational.client;

import io.vertx.core.json.DecodeException;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Thin client over the Meta WhatsApp Cloud API send endpoint
 * ({@code POST {baseUrl}/{phone_number_id}/messages}). Builds the JSON payloads for text
 * and template messages and returns Meta's message id (wamid) on success. Stateless: the
 * caller passes the resolved connection's base URL, phone-number-id and bearer token.
 */
@ApplicationScoped
public class MetaWhatsAppClient {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(15);
    private static final String MESSAGING_PRODUCT = "messaging_product";
    private static final String WHATSAPP = "whatsapp";

    private final HttpClient httpClient;

    public MetaWhatsAppClient() {
        this(HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build());
    }

    MetaWhatsAppClient(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /** Sends a free-form session text message. Returns the Meta message id (wamid). */
    public String sendText(URI baseUrl, String phoneNumberId, String token, String toE164, String body) {
        JsonObject payload = new JsonObject()
                .put(MESSAGING_PRODUCT, WHATSAPP)
                .put("recipient_type", "individual")
                .put("to", toE164)
                .put("type", "text")
                .put("text", new JsonObject().put("preview_url", false).put("body", body));
        return send(baseUrl, phoneNumberId, token, payload);
    }

    /**
     * Sends a pre-approved template message. {@code namedParams} fill the template's NAMED
     * body placeholders by name (e.g. {@code driver_name}, {@code trip_reference}). Returns
     * the Meta message id (wamid).
     */
    public String sendTemplate(
            URI baseUrl,
            String phoneNumberId,
            String token,
            String toE164,
            String templateName,
            String languageCode,
            Map<String, String> namedParams) {
        JsonObject template = new JsonObject()
                .put("name", templateName)
                .put("language", new JsonObject().put("code", languageCode));
        if (namedParams != null && !namedParams.isEmpty()) {
            JsonArray parameters = new JsonArray();
            for (Map.Entry<String, String> param : namedParams.entrySet()) {
                parameters.add(new JsonObject()
                        .put("type", "text")
                        .put("parameter_name", param.getKey())
                        .put("text", param.getValue()));
            }
            template.put("components", new JsonArray().add(
                    new JsonObject().put("type", "body").put("parameters", parameters)));
        }
        JsonObject payload = new JsonObject()
                .put(MESSAGING_PRODUCT, WHATSAPP)
                .put("to", toE164)
                .put("type", "template")
                .put("template", template);
        return send(baseUrl, phoneNumberId, token, payload);
    }

    private String send(URI baseUrl, String phoneNumberId, String token, JsonObject payload) {
        URI uri = URI.create(trimTrailingSlash(baseUrl.toString()) + "/" + phoneNumberId + "/messages");
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.encode()))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new WhatsAppSendException("Could not reach Meta Graph API: " + e.getMessage(), null, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new WhatsAppSendException("WhatsApp send was interrupted", null, e);
        }

        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            throw new WhatsAppSendException(parseError(response.body(), status), status, null);
        }
        return parseMessageId(response.body());
    }

    private static String parseMessageId(String body) {
        try {
            JsonArray messages = new JsonObject(body).getJsonArray("messages");
            if (messages != null && !messages.isEmpty()) {
                String id = messages.getJsonObject(0).getString("id");
                if (id != null && !id.isBlank()) {
                    return id;
                }
            }
        } catch (DecodeException e) {
            throw new WhatsAppSendException("Meta response was not valid JSON", null, e);
        }
        throw new WhatsAppSendException("Meta response did not contain a message id", null, null);
    }

    private static String parseError(String body, int status) {
        try {
            JsonObject error = new JsonObject(body).getJsonObject("error");
            if (error != null && error.getString("message") != null) {
                return "Meta Graph API error (HTTP " + status + "): " + error.getString("message");
            }
        } catch (DecodeException e) {
            // Non-JSON error body; fall back to the status-only message below.
        }
        return "Meta Graph API returned HTTP " + status;
    }

    private static String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
