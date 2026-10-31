package com.microboxlabs.miot.conversational.client;

import io.vertx.core.json.DecodeException;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Thin client over the Meta message template endpoints of a WhatsApp Business Account:
 * {@code GET|POST|DELETE {baseUrl}/{waba_id}/message_templates} and {@code GET|POST {baseUrl}/{template_id}}.
 * Stateless: the caller passes the resolved connection's base URL, WABA id and bearer token. Returns Meta's
 * JSON; a failed call raises {@link MetaGraphException}.
 */
@ApplicationScoped
public class MetaTemplatesClient {

    public static final String FIELDS =
            "name,language,status,category,components,rejected_reason,id,parameter_format";
    static final int PAGE_SIZE = 100;
    static final int MAX_PAGES = 20;
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(15);
    private static final String MESSAGE_TEMPLATES = "/message_templates";

    private final HttpClient httpClient;

    public MetaTemplatesClient() {
        this(HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build());
    }

    MetaTemplatesClient(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /** Every template on the WABA, following Meta's {@code after} cursor up to {@value #MAX_PAGES} pages. */
    public List<JsonObject> list(URI baseUrl, String wabaId, String token) {
        List<JsonObject> out = new ArrayList<>();
        String after = null;
        for (int page = 0; page < MAX_PAGES; page++) {
            String query = "?fields=" + FIELDS + "&limit=" + PAGE_SIZE + (after == null ? "" : "&after=" + enc(after));
            JsonObject body = call(get(uri(baseUrl, "/" + enc(wabaId) + MESSAGE_TEMPLATES + query), token));
            JsonArray data = body.getJsonArray("data", new JsonArray());
            for (int i = 0; i < data.size(); i++) {
                out.add(data.getJsonObject(i));
            }
            JsonObject paging = body.getJsonObject("paging");
            JsonObject cursors = paging == null ? null : paging.getJsonObject("cursors");
            after = cursors == null ? null : cursors.getString("after");
            if (paging == null || paging.getString("next") == null || after == null || data.isEmpty()) {
                break;
            }
        }
        return out;
    }

    /** One template by its id. */
    public JsonObject get(URI baseUrl, String templateId, String token) {
        return call(get(uri(baseUrl, "/" + enc(templateId) + "?fields=" + FIELDS), token));
    }

    /** Submits a new template; Meta answers {@code {id, status, category}}. */
    public JsonObject create(URI baseUrl, String wabaId, String token, JsonObject template) {
        return call(post(uri(baseUrl, "/" + enc(wabaId) + MESSAGE_TEMPLATES), token, template));
    }

    /** Edits a template's components or category; Meta answers {@code {success}}. */
    public JsonObject edit(URI baseUrl, String templateId, String token, JsonObject changes) {
        return call(post(uri(baseUrl, "/" + enc(templateId)), token, changes));
    }

    /** Deletes the template by name, every language, or only the one with {@code templateId} when given. */
    public void delete(URI baseUrl, String wabaId, String token, String name, String templateId) {
        String query = "?name=" + enc(name) + (templateId == null ? "" : "&hsm_id=" + enc(templateId));
        call(authorized(uri(baseUrl, "/" + enc(wabaId) + MESSAGE_TEMPLATES + query), token).DELETE().build());
    }

    private static HttpRequest get(URI uri, String token) {
        return authorized(uri, token).GET().build();
    }

    private static HttpRequest post(URI uri, String token, JsonObject payload) {
        return authorized(uri, token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.encode()))
                .build();
    }

    private static HttpRequest.Builder authorized(URI uri, String token) {
        return HttpRequest.newBuilder(uri).timeout(REQUEST_TIMEOUT).header("Authorization", "Bearer " + token);
    }

    private JsonObject call(HttpRequest request) {
        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new MetaGraphException("Could not reach Meta Graph API: " + e.getMessage(), null, null, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MetaGraphException("The call to Meta was interrupted", null, null, e);
        }
        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            throw error(response.body(), status);
        }
        String body = response.body();
        if (body == null || body.isBlank()) {
            return new JsonObject();
        }
        try {
            return new JsonObject(body);
        } catch (DecodeException e) {
            throw new MetaGraphException("Meta response was not valid JSON", status, null, e);
        }
    }

    static MetaGraphException error(String body, int status) {
        try {
            JsonObject error = new JsonObject(body).getJsonObject("error");
            if (error != null) {
                String userMessage = error.getString("error_user_msg");
                String title = error.getString("error_user_title");
                String text = error.getString("message");
                if (userMessage != null && !userMessage.isBlank()) {
                    text = title != null && !title.isBlank() ? title + ": " + userMessage : userMessage;
                }
                Integer code = error.getValue("code") instanceof Number n ? n.intValue() : null;
                if (text != null) {
                    return new MetaGraphException("Meta: " + text, status, code, null);
                }
            }
        } catch (DecodeException | ClassCastException e) {
            // Not Meta's JSON error; fall back to the status below.
        }
        return new MetaGraphException("Meta Graph API returned HTTP " + status, status, null, null);
    }

    private static URI uri(URI baseUrl, String pathAndQuery) {
        String base = baseUrl.toString();
        return URI.create((base.endsWith("/") ? base.substring(0, base.length() - 1) : base) + pathAndQuery);
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
