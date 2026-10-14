package com.microboxlabs.miot.integrations.vehicleimages;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.net.BoundedHttpTransport;
import jakarta.enterprise.context.ApplicationScoped;
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
import java.util.StringJoiner;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Calls carimagesapi.com from the server. The account key goes in {@code api_key}; the secret goes in the
 * {@code X-Api-Secret} header and never leaves the server.
 */
@ApplicationScoped
public class CarImagesClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final int MAX_BYTES = 64 * 1024;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final HttpClient httpClient;
    private final URI baseUrl;

    public CarImagesClient(
            @ConfigProperty(name = "miot.integrations.car-images.base-url", defaultValue = "https://carimagesapi.com")
            URI baseUrl) {
        this.httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
        this.baseUrl = baseUrl;
    }

    public URI baseUrl() {
        return baseUrl;
    }

    /** Only the configured host: the secret is sent to no other. */
    public boolean serves(URI url) {
        return url != null && baseUrl.getHost().equalsIgnoreCase(url.getHost())
                && baseUrl.getScheme().equalsIgnoreCase(url.getScheme());
    }

    /** {@code GET /api/v1/signed-url}: a signed image URL, or the HTTP status when there is none. */
    public SignedUrl signedUrl(String apiKey, String secret, Map<String, String> params)
            throws IOException, InterruptedException {
        Map<String, String> query = new LinkedHashMap<>();
        query.put("api_key", apiKey);
        query.putAll(params);
        HttpResponse<String> response = get("/api/v1/signed-url", query, secret);
        if (response.statusCode() != 200) {
            return new SignedUrl(null, response.statusCode());
        }
        JsonNode url = JSON.readTree(response.body()).get("url");
        return new SignedUrl(url == null || url.isNull() ? null : url.asText(), response.statusCode());
    }

    /** {@code GET /api/v1/makes}: the cheapest call that needs both the key and the secret. */
    public int checkKey(String apiKey, String secret) throws IOException, InterruptedException {
        return get("/api/v1/makes", Map.of("api_key", apiKey), secret).statusCode();
    }

    private HttpResponse<String> get(String path, Map<String, String> query, String secret)
            throws IOException, InterruptedException {
        StringJoiner params = new StringJoiner("&");
        query.forEach((k, v) -> params.add(encode(k) + "=" + encode(v)));
        HttpRequest request = HttpRequest.newBuilder(baseUrl.resolve(path + "?" + params))
                .timeout(TIMEOUT)
                .header(CarImagesKeys.SECRET_HEADER, secret)
                .header("Accept", "application/json")
                .GET()
                .build();
        return BoundedHttpTransport.send(httpClient, request, MAX_BYTES, TIMEOUT);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record SignedUrl(String url, int status) {
    }
}
