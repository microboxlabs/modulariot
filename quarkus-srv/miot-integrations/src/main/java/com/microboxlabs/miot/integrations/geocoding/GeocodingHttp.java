package com.microboxlabs.miot.integrations.geocoding;

import com.microboxlabs.miot.integrations.net.BoundedHttpTransport;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.StringJoiner;

/** GET with a short deadline and a bounded body. The URL holds the token, so no message quotes it. */
final class GeocodingHttp {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final int MAX_BYTES = 256 * 1024;
    private static final HttpClient CLIENT = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

    private GeocodingHttp() {
    }

    static HttpResponse<String> get(URI base, String path, Map<String, String> query)
            throws IOException, InterruptedException {
        StringJoiner params = new StringJoiner("&");
        query.forEach((k, v) -> params.add(encode(k) + "=" + encode(v == null ? "" : v)));
        HttpRequest request;
        try {
            request = HttpRequest.newBuilder(base.resolve(path + "?" + params))
                    .timeout(TIMEOUT)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
        } catch (IllegalArgumentException e) {
            throw new IOException("Cannot build the geocoding request");
        }
        try {
            return BoundedHttpTransport.send(CLIENT, request, MAX_BYTES, TIMEOUT);
        } catch (IOException e) {
            throw new IOException("The geocoding provider did not answer: " + e.getClass().getSimpleName());
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
