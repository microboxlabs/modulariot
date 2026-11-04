package com.microboxlabs.miot.integrations.telephony;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.core.telephony.WebRtcToken;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.function.BiFunction;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Issues Telnyx WebRTC tokens. Each operator has one telephony credential (a SIP login) under the
 * connection's credential connection, found by a name derived from the organization and the operator,
 * and created on first use. Nothing is stored here: the name is the key. Places no call.
 */
@ApplicationScoped
public class TelnyxWebRtcTokens {

    /** Telnyx accepts a token for 24 hours; the app asks again before that. */
    static final Duration TOKEN_TTL = Duration.ofHours(24);

    private final BiFunction<String, String, IntegrationConnection> connections;
    private final BiFunction<String, IntegrationConnection, ResolvedConnection> resolver;
    private final TelnyxClient client;
    private final ObjectMapper json;
    private final Clock clock;
    private final String webhookBaseUrl;

    @Inject
    public TelnyxWebRtcTokens(IntegrationConnectionRepository repository, IntegrationConnectionResolver resolver,
            TelnyxClient client, ObjectMapper json,
            @ConfigProperty(name = "miot.integrations.telephony.webhook-base-url") Optional<String> webhookBaseUrl) {
        this(repository::findByTenantAndId, resolver::resolve, client, json, Clock.systemUTC(), webhookBaseUrl.orElse(""));
    }

    public TelnyxWebRtcTokens(BiFunction<String, String, IntegrationConnection> connections,
            BiFunction<String, IntegrationConnection, ResolvedConnection> resolver, TelnyxClient client,
            ObjectMapper json, Clock clock) {
        this(connections, resolver, client, json, clock, "");
    }

    public TelnyxWebRtcTokens(BiFunction<String, String, IntegrationConnection> connections,
            BiFunction<String, IntegrationConnection, ResolvedConnection> resolver, TelnyxClient client,
            ObjectMapper json, Clock clock, String webhookBaseUrl) {
        this.connections = connections;
        this.resolver = resolver;
        this.client = client;
        this.json = json;
        this.clock = clock;
        this.webhookBaseUrl = trimTrailingSlashes(webhookBaseUrl);
    }

    private static String trimTrailingSlashes(String value) {
        int end = value.length();
        while (end > 0 && value.charAt(end - 1) == '/') end--;
        return value.substring(0, end);
    }

    /** A token, the operator's credential, and the connection it was issued on. */
    public record Issued(WebRtcToken token, String credentialId, String sipUsername,
            IntegrationConnection connection) {
    }

    public WebRtcToken issue(String tenantCode, String connectionId, String operator) {
        return issueFor(tenantCode, connectionId, tenantCode, operator).token();
    }

    /**
     * @param connectionTenant the tenant that owns the connection: the organization, or the platform for the
     *                         managed line
     * @param callingTenant    the organization the operator works for; it names the operator's credential
     */
    public Issued issueFor(String connectionTenant, String connectionId, String callingTenant, String operator) {
        if (operator == null || operator.isBlank()) {
            throw new IllegalArgumentException("operator is required");
        }
        IntegrationConnection connection = connections.apply(connectionTenant, connectionId);
        if (connection == null || connection.providerType() != ProviderType.TELNYX) {
            throw new TelephonyUnavailableException("The organization has no Telnyx connection");
        }
        if (connection.status() != ConnectionStatus.ACTIVE) {
            throw new TelephonyUnavailableException("The Telnyx connection has not passed its test");
        }
        if (!client.serves(connection.baseUrl())) {
            throw new TelephonyUnavailableException("The Telnyx connection must use " + client.baseUrl());
        }
        ResolvedConnection resolved;
        try {
            resolved = resolver.apply(connectionTenant, connection);
        } catch (ConnectionResolutionException e) {
            throw new TelephonyUnavailableException(e.getMessage());
        }
        String apiKey = resolved.secretString(TelephonyKeys.TOKEN);
        String sipConnectionId = resolved.metadataString(TelephonyKeys.SIP_CONNECTION_ID);
        String callerNumber = PhoneNumbers.e164(resolved.metadataString(TelephonyKeys.CALLER_NUMBER));
        if (apiKey == null || apiKey.isBlank() || sipConnectionId == null || callerNumber == null) {
            throw new TelephonyUnavailableException("The Telnyx connection is incomplete; test it in Conexiones");
        }
        try {
            requireParkedConnection(apiKey.trim(), sipConnectionId, connection.id());
            JsonNode credential = credentialFor(apiKey.trim(), sipConnectionId,
                    credentialName(callingTenant, operator));
            String credentialId = credential.path("id").asText();
            HttpResponse<String> response = client.telephonyToken(apiKey.trim(), credentialId);
            require(response, "issue the token");
            String token = tokenOf(response.body());
            return new Issued(new WebRtcToken(token, callerNumber, clock.instant().plus(TOKEN_TTL)), credentialId,
                    blankToNull(credential.path("sip_username").asText("")), connection);
        } catch (IOException e) {
            throw new TelephonyUnavailableException("Could not reach Telnyx: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TelephonyUnavailableException("The Telnyx token request was interrupted");
        }
    }

    private void requireParkedConnection(String apiKey, String sipConnectionId, String connectionId)
            throws IOException, InterruptedException {
        if (!webhookBaseUrl.startsWith("https://")) {
            throw new TelephonyUnavailableException("Configure miot.integrations.telephony.webhook-base-url before issuing Telnyx logins");
        }
        HttpResponse<String> response = client.credentialConnection(apiKey, sipConnectionId);
        require(response, "verify parked-call admission");
        JsonNode c = read(response.body()).path("data");
        String expectedWebhook = webhookBaseUrl + "/webhooks/telnyx/" + connectionId;
        String failover = c.path("webhook_event_failover_url").asText("");
        if (!c.path("active").asBoolean(false) || !c.path("outbound").path("call_parking_enabled").asBoolean(false)
                || !"2".equals(c.path("webhook_api_version").asText())
                || !expectedWebhook.equals(c.path("webhook_event_url").asText())
                || (!failover.isBlank() && !expectedWebhook.equals(failover))
                || !"disabled".equals(c.path("sip_uri_calling_preference").asText())) {
            throw new TelephonyUnavailableException("Telnyx must park outbound calls at this server's v2 webhook and disable direct SIP URI calls");
        }
    }

    /** The operator's credential under this credential connection, created when there is none usable. */
    private JsonNode credentialFor(String apiKey, String sipConnectionId, String name)
            throws IOException, InterruptedException {
        HttpResponse<String> found = client.telephonyCredentials(apiKey, name);
        require(found, "list the telephony credentials");
        for (JsonNode c : read(found.body()).path("data")) {
            if (name.equals(c.path("name").asText()) && onConnection(c, sipConnectionId)
                    && !c.path("expired").asBoolean(false) && !c.path("id").asText().isBlank()) {
                return c;
            }
        }
        HttpResponse<String> created = client.createTelephonyCredential(apiKey, sipConnectionId, name);
        require(created, "create the operator's telephony credential");
        JsonNode data = read(created.body()).path("data");
        if (data.path("id").asText().isBlank()) {
            throw new TelephonyUnavailableException("Telnyx created a telephony credential without an id");
        }
        return data;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /** Telnyx names the credential's connection in {@code resource_id} as {@code connection:<id>}. */
    private static boolean onConnection(JsonNode credential, String sipConnectionId) {
        return ("connection:" + sipConnectionId).equals(credential.path("resource_id").asText())
                || sipConnectionId.equals(credential.path("connection_id").asText());
    }

    /** Not the operator's email: the name is visible in the Telnyx portal. */
    static String credentialName(String tenantCode, String operator) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((tenantCode + "\n" + operator.trim().toLowerCase(java.util.Locale.ROOT))
                            .getBytes(StandardCharsets.UTF_8));
            return "miot-op-" + HexFormat.of().formatHex(digest).substring(0, 32);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    /** Telnyx answers the token as plain text; a JSON string or {@code data.token} is accepted too. */
    private String tokenOf(String body) {
        String text = body == null ? "" : body.trim();
        if (text.startsWith("{") || text.startsWith("\"")) {
            JsonNode node = read(text);
            text = node.isTextual() ? node.asText() : node.path("data").path("token").asText();
        }
        if (text.isBlank()) {
            throw new TelephonyUnavailableException("Telnyx returned an empty token");
        }
        return text;
    }

    private JsonNode read(String body) {
        try {
            JsonNode value = json.readTree(body == null ? "{}" : body);
            if (value == null || value.isNull()) {
                throw new TelephonyUnavailableException("Telnyx returned an empty JSON body");
            }
            return value;
        } catch (IOException e) {
            throw new TelephonyUnavailableException("Telnyx returned a body that is not JSON");
        }
    }

    private static void require(HttpResponse<String> response, String what) {
        int status = response.statusCode();
        if (status == 401 || status == 403) {
            throw new TelephonyUnavailableException("Telnyx rejected the API key; could not " + what);
        }
        if (status < 200 || status >= 300) {
            throw new TelephonyUnavailableException("Telnyx returned HTTP " + status + "; could not " + what);
        }
    }
}
