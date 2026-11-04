package com.microboxlabs.miot.integrations.telephony;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Calls the Telnyx API v2. Blocking. The API's address is server configuration
 * ({@code miot.integrations.telnyx.base-url}), never a connection's, so a stored key only goes to Telnyx.
 */
@ApplicationScoped
public class TelnyxClient {

    private final TelephonyHttp http;
    private final URI baseUrl;

    @Inject
    public TelnyxClient(
            @ConfigProperty(name = "miot.integrations.telnyx.base-url", defaultValue = "https://api.telnyx.com")
            URI baseUrl) {
        this(TelephonyHttp.network(), baseUrl);
    }

    public TelnyxClient(TelephonyHttp http, URI baseUrl) {
        this.http = http;
        this.baseUrl = baseUrl;
    }

    public URI baseUrl() {
        return baseUrl;
    }

    /** Whether a connection's base URL names this client's API (unset counts). */
    public boolean serves(URI connectionBaseUrl) {
        return connectionBaseUrl == null || trim(connectionBaseUrl.toString()).equals(trim(baseUrl.toString()));
    }

    /** {@code GET /v2/balance}: the cheapest call that proves the key. */
    public HttpResponse<String> balance(String apiKey) throws IOException, InterruptedException {
        return http.send(get(apiKey, "/v2/balance"));
    }

    /** {@code GET /v2/credential_connections/{id}}: whether the SIP connection exists for this key. */
    public HttpResponse<String> credentialConnection(String apiKey, String connectionId)
            throws IOException, InterruptedException {
        return http.send(get(apiKey, "/v2/credential_connections/" + segment(connectionId)));
    }

    /** {@code GET /v2/telephony_credentials?filter[name]=..}: the telephony credentials with this name. */
    public HttpResponse<String> telephonyCredentials(String apiKey, String name)
            throws IOException, InterruptedException {
        return http.send(get(apiKey, "/v2/telephony_credentials?" + segment("filter[name]") + "=" + segment(name)));
    }

    /** {@code POST /v2/telephony_credentials}: a SIP login under a credential connection. Free; places no call. */
    public HttpResponse<String> createTelephonyCredential(String apiKey, String connectionId, String name)
            throws IOException, InterruptedException {
        String body = "{\"connection_id\":" + json(connectionId) + ",\"name\":" + json(name) + "}";
        return http.send(request(apiKey, "/v2/telephony_credentials")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build());
    }

    /** {@code POST /v2/telephony_credentials/{id}/token}: a JWT for the browser SDK, valid for 24 hours. */
    public HttpResponse<String> telephonyToken(String apiKey, String credentialId)
            throws IOException, InterruptedException {
        return http.send(request(apiKey, "/v2/telephony_credentials/" + segment(credentialId) + "/token")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build());
    }

    /** {@code GET /v2/detail_records}: SIP trunking records of the last 3 days, one page of up to 50. */
    public HttpResponse<String> detailRecords(String apiKey, int page) throws IOException, InterruptedException {
        return http.send(get(apiKey, "/v2/detail_records?" + segment("filter[record_type]") + "=sip-trunking&"
                + segment("filter[date_range]") + "=last_3_days&" + segment("page[number]") + "=" + page + "&"
                + segment("page[size]") + "=50"));
    }

    private static String json(String value) {
        StringBuilder out = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            if (c == '"' || c == '\\') {
                out.append('\\').append(c);
            } else if (c < 0x20) {
                out.append(String.format("\\u%04x", (int) c));
            } else {
                out.append(c);
            }
        }
        return out.append('"').toString();
    }

    HttpRequest get(String apiKey, String path) {
        return request(apiKey, path).GET().build();
    }

    HttpRequest.Builder request(String apiKey, String path) {
        return HttpRequest.newBuilder(URI.create(trim(baseUrl.toString()) + path))
                .timeout(TelephonyHttp.TIMEOUT)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json");
    }

    HttpResponse<String> send(HttpRequest request) throws IOException, InterruptedException {
        return http.send(request);
    }

    static String segment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String trim(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
