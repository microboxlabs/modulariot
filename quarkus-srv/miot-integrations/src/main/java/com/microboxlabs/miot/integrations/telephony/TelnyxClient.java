package com.microboxlabs.miot.integrations.telephony;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
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
        Instant now = Instant.now();
        return detailRecords(apiKey, page, now, now);
    }

    /** Keep the initial lookback in scope whether Telnyx interprets days as rolling or calendar days. */
    public HttpResponse<String> detailRecords(String apiKey, int page, Instant scanStartedAt, Instant now)
            throws IOException, InterruptedException {
        long seconds = Math.max(0, Duration.between(scanStartedAt, now).getSeconds());
        long days = 3 + (seconds + 86399) / 86400;
        return http.send(get(apiKey, "/v2/detail_records?" + segment("filter[record_type]") + "=sip-trunking&"
                + segment("filter[date_range]") + "=last_" + days + "_days&" + segment("page[number]") + "=" + page + "&"
                + segment("page[size]") + "=50&sort=-started_at"));
    }

    /** Only the server can turn a parked WebRTC leg into a PSTN call. */
    public HttpResponse<String> transfer(String apiKey, String callId, String to, String from,
            String targetState, String commandId, int timeLimitSeconds) throws IOException, InterruptedException {
        return command(apiKey, callId, "transfer", "{\"to\":" + json(to) + ",\"from\":" + json(from)
                + ",\"target_leg_client_state\":" + json(targetState) + ",\"command_id\":" + json(commandId)
                + ",\"timeout_secs\":30,\"time_limit_secs\":" + timeLimitSeconds + "}");
    }

    /** A WhatsApp leg to dial on the WhatsApp Call Control application. */
    public record WhatsAppDial(String connectionId, String to, String from, String sipUsername, String sipPassword,
            String mediaEncryption, String clientState, String commandId, String linkTo, int timeLimitSeconds) {

        @Override
        public String toString() {
            return "WhatsAppDial[connectionId=" + connectionId + ", to=" + to + ", sipPassword=<redacted>]";
        }
    }

    /** {@code POST /v2/calls}: Telnyx's documented outbound call to WhatsApp over SIP (TLS, OPUS). */
    public HttpResponse<String> dialWhatsApp(String apiKey, WhatsAppDial d) throws IOException, InterruptedException {
        String body = "{\"connection_id\":" + json(d.connectionId()) + ",\"to\":" + json(d.to())
                + ",\"from\":" + json(d.from()) + ",\"sip_auth_username\":" + json(d.sipUsername())
                + ",\"sip_auth_password\":" + json(d.sipPassword())
                + ",\"sip_transport_protocol\":\"TLS\",\"media_encryption\":" + json(d.mediaEncryption())
                + ",\"preferred_codecs\":\"OPUS\",\"client_state\":" + json(d.clientState())
                + ",\"command_id\":" + json(d.commandId()) + ",\"link_to\":" + json(d.linkTo())
                + ",\"timeout_secs\":45,\"time_limit_secs\":" + d.timeLimitSeconds() + "}";
        return http.send(request(apiKey, "/v2/calls")
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }

    /** Joins {@code callId} with {@code otherCallId}. */
    public HttpResponse<String> bridge(String apiKey, String callId, String otherCallId, String commandId)
            throws IOException, InterruptedException {
        return command(apiKey, callId, "bridge", "{\"call_control_id\":" + json(otherCallId) + ",\"command_id\":"
                + json(commandId) + "}");
    }

    /** Answers an incoming call; Telnyx echoes {@code clientState} on its later events. */
    public HttpResponse<String> answer(String apiKey, String callId, String clientState, String commandId)
            throws IOException, InterruptedException {
        return command(apiKey, callId, "answer", "{\"client_state\":" + json(clientState) + ",\"command_id\":"
                + json(commandId) + "}");
    }

    /** Text to speech on an answered call, in Spanish. */
    public HttpResponse<String> speak(String apiKey, String callId, String text, String clientState)
            throws IOException, InterruptedException {
        return command(apiKey, callId, "speak", "{\"payload\":" + json(text)
                + ",\"voice\":\"female\",\"language\":\"es-ES\",\"client_state\":" + json(clientState) + "}");
    }

    public HttpResponse<String> hangup(String apiKey, String callId) throws IOException, InterruptedException {
        return command(apiKey, callId, "hangup", "{}");
    }

    private HttpResponse<String> command(String apiKey, String callId, String action, String body)
            throws IOException, InterruptedException {
        return http.send(request(apiKey, "/v2/calls/" + segment(callId) + "/actions/" + action)
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build());
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
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(trim(baseUrl.toString()) + path))
                .timeout(TelephonyHttp.TIMEOUT)
                .header("Accept", "application/json");
        try {
            return request.header("Authorization", "Bearer " + apiKey);
        } catch (IllegalArgumentException ignored) {
            // The JDK exception includes the header value. Never retain it as a cause.
            throw new IllegalArgumentException("The API key is not a valid HTTP bearer token");
        }
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
