package com.microboxlabs.miot.integrations.orgaccount;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

final class GoogleCalls {

    private static final org.jboss.logging.Logger LOG = org.jboss.logging.Logger.getLogger(GoogleCalls.class);

    private GoogleCalls() {
    }

    /** The JSON body of a 2xx answer; anything else is a {@link GoogleCallException}. */
    static JsonNode send(HttpClient http, ObjectMapper json, HttpRequest request, String what) {
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            LOG.warnf(e, "The %s request failed", what);
            throw new GoogleCallException(502, "The " + what + " request failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GoogleCallException(502, "The " + what + " request was interrupted");
        }
        int status = response.statusCode();
        JsonNode body = parse(json, response.body());
        if (status < 200 || status >= 300) {
            throw new GoogleCallException(status, "The " + what + " request failed with HTTP " + status
                    + message(body));
        }
        return body;
    }

    private static JsonNode parse(ObjectMapper json, String body) {
        if (body == null || body.isBlank()) return json.createObjectNode();
        try {
            return json.readTree(body);
        } catch (IOException e) {
            return json.createObjectNode();
        }
    }

    /** Google's {@code error.message} (or an OAuth {@code error} code); never a token. */
    private static String message(JsonNode body) {
        JsonNode error = body.path("error");
        if (error.isObject() && error.path("message").isTextual()) return ": " + error.path("message").asText();
        if (error.isTextual()) return " (" + error.asText() + ")";
        return "";
    }
}
