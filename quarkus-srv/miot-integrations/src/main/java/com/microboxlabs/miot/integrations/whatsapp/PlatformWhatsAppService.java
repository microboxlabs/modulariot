package com.microboxlabs.miot.integrations.whatsapp;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.PlatformConnectionStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The platform's WhatsApp account: one WHATSAPP connection under the reserved platform tenant. Its WABA holds the
 * WhatsApp variants of the platform's message templates, so rule messages are sent from it. Stored like an
 * organization's WhatsApp connection: a bearer credential with secret {@code token}, and the ids in the
 * connection metadata. Blocking.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformWhatsAppService {

    static final String NAME = "Plataforma WhatsApp";
    static final String PHONE_NUMBER_ID = "phone_number_id";
    static final String WABA_ID = "waba_id";
    static final String DISPLAY_PHONE_NUMBER = "display_phone_number";
    static final String GRAPH_VERSION = "graph_version";
    static final String TEST_MODE_ENABLED = "test_mode_enabled";
    static final String TEST_RECIPIENTS = "test_recipients";
    static final String TOKEN = "token";
    static final String DEFAULT_GRAPH_VERSION = "v25.0";
    private static final String GRAPH_HOST = "https://graph.facebook.com/";
    private static final Pattern META_ID = Pattern.compile("\\d{1,30}");
    private static final Pattern GRAPH_VERSION_FORMAT = Pattern.compile("v\\d{1,3}\\.\\d{1,3}");

    /** {@code configured} is false and the rest null when the platform has no WhatsApp account. */
    public record PlatformWhatsAppView(boolean configured, String connectionId, String phoneNumberId, String wabaId,
            String displayPhoneNumber, String graphVersion, String baseUrl, Boolean testModeEnabled,
            List<String> testRecipients, String tokenPreview, String status, OffsetDateTime lastTestedAt,
            Boolean lastTestResult) {

        static PlatformWhatsAppView none() {
            return new PlatformWhatsAppView(false, null, null, null, null, null, null, null, null, null, null, null,
                    null);
        }
    }

    /**
     * {@code accessToken}: required the first time; blank keeps the stored token. {@code graphVersion} defaults to
     * {@value #DEFAULT_GRAPH_VERSION}; {@code baseUrl} to the Graph API of that version.
     */
    public record SetPlatformWhatsAppRequest(String phoneNumberId, String wabaId, String displayPhoneNumber,
            String graphVersion, String baseUrl, String accessToken, Boolean testModeEnabled,
            List<String> testRecipients) {
    }

    private final IntegrationConnectionService connections;
    private final IntegrationConnectionRepository repository;
    private final PlatformConnectionStore store;

    @Inject
    public PlatformWhatsAppService(IntegrationConnectionService connections,
            IntegrationConnectionRepository repository, CredentialProfileService credentials) {
        this.connections = connections;
        this.repository = repository;
        this.store = new PlatformConnectionStore(connections, repository, credentials, ProviderType.WHATSAPP, NAME);
    }

    public PlatformWhatsAppView get() {
        IntegrationConnection connection = store.find();
        return connection == null ? PlatformWhatsAppView.none() : view(connection);
    }

    /**
     * Saves the account and tests it with Meta right away, so the status describes what is in use.
     *
     * @throws IllegalArgumentException for a missing or malformed field, or a missing token on first save
     * @throws IllegalStateException when an organization's WhatsApp connection already uses the phone number id
     */
    public PlatformWhatsAppView put(SetPlatformWhatsAppRequest body, String actor) {
        if (body == null) {
            throw new IllegalArgumentException("phoneNumberId and wabaId are required");
        }
        String token = trim(body.accessToken());
        Settings settings = settings(body);
        IntegrationConnection existing = store.find();
        IntegrationConnection owner = repository.findActiveWhatsAppByPhoneNumberId(settings.phoneNumberId());
        if (owner != null && (existing == null || !owner.id().equals(existing.id()))) {
            throw new IllegalStateException("Another WhatsApp connection already uses phone number id "
                    + settings.phoneNumberId() + "; remove it first");
        }
        String connectionId;
        if (existing == null) {
            if (token.isEmpty()) {
                throw new IllegalArgumentException("accessToken is required");
            }
            connectionId = store.create(AuthType.BEARER_TOKEN, Map.of(), Map.of(TOKEN, token), settings.baseUrl(),
                    settings.metadata(), actor);
        } else {
            connectionId = existing.id();
            if (!token.isEmpty()) {
                store.rotateSecret(existing, Map.of(TOKEN, token));
            }
            connections.updateConnection(PLATFORM_TENANT, connectionId, new UpdateIntegrationConnectionRequest(
                    null, settings.baseUrl(), settings.metadata(), null, null));
        }
        store.test(connectionId);
        return get();
    }

    /** @return false when no account was set */
    public boolean delete(String actor) {
        return store.delete(actor);
    }

    /** Checks the stored token and phone number id with Meta; null when no account is set. */
    public ConnectionTestResponse test() {
        return store.test();
    }

    record Settings(String phoneNumberId, URI baseUrl, Map<String, Object> metadata) {
    }

    /** The connection's base URL and metadata from a request, in the keys an organization's connection uses. */
    static Settings settings(SetPlatformWhatsAppRequest body) {
        String phoneNumberId = metaId("phoneNumberId", body.phoneNumberId());
        String wabaId = metaId("wabaId", body.wabaId());
        String version = trim(body.graphVersion());
        if (version.isEmpty()) {
            version = DEFAULT_GRAPH_VERSION;
        } else if (!GRAPH_VERSION_FORMAT.matcher(version).matches()) {
            throw new IllegalArgumentException("graphVersion must look like v25.0");
        }
        String base = trim(body.baseUrl());
        URI baseUrl = base.isEmpty() ? URI.create(GRAPH_HOST + version) : httpsUrl(base);
        List<String> recipients = new ArrayList<>();
        if (body.testRecipients() != null) {
            body.testRecipients().stream().map(PlatformWhatsAppService::trim).filter(r -> !r.isEmpty())
                    .forEach(recipients::add);
        }
        boolean testMode = Boolean.TRUE.equals(body.testModeEnabled());
        if (testMode && recipients.isEmpty()) {
            throw new IllegalArgumentException("testRecipients needs at least one number when testModeEnabled");
        }
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put(PHONE_NUMBER_ID, phoneNumberId);
        metadata.put(WABA_ID, wabaId);
        String display = trim(body.displayPhoneNumber());
        if (!display.isEmpty()) {
            metadata.put(DISPLAY_PHONE_NUMBER, display);
        }
        metadata.put(GRAPH_VERSION, version);
        metadata.put(TEST_MODE_ENABLED, testMode);
        metadata.put(TEST_RECIPIENTS, recipients);
        return new Settings(phoneNumberId, baseUrl, metadata);
    }

    private static String metaId(String field, String value) {
        String id = trim(value);
        if (!META_ID.matcher(id).matches()) {
            throw new IllegalArgumentException(field + " is required: Meta's numeric id");
        }
        return id;
    }

    private static URI httpsUrl(String value) {
        try {
            URI uri = URI.create(value);
            if ("https".equals(uri.getScheme()) && uri.getHost() != null) {
                return uri;
            }
        } catch (IllegalArgumentException e) {
            // reported below
        }
        throw new IllegalArgumentException("baseUrl must be an https URL");
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private PlatformWhatsAppView view(IntegrationConnection connection) {
        Map<String, Object> metadata = connection.metadata() == null ? Map.of() : connection.metadata();
        return new PlatformWhatsAppView(true, connection.id(), string(metadata, PHONE_NUMBER_ID),
                string(metadata, WABA_ID), string(metadata, DISPLAY_PHONE_NUMBER), string(metadata, GRAPH_VERSION),
                connection.baseUrl() == null ? null : connection.baseUrl().toString(),
                isTruthy(metadata.get(TEST_MODE_ENABLED)), recipients(metadata.get(TEST_RECIPIENTS)),
                store.secretPreview(connection), connection.status() == null ? null : connection.status().name(),
                connection.lastTestedAt(), connection.lastTestResult());
    }

    private static String string(Map<String, Object> metadata, String key) {
        Object value = metadata.get(key);
        return value == null ? null : value.toString();
    }

    private static boolean isTruthy(Object value) {
        return Boolean.TRUE.equals(value) || "true".equalsIgnoreCase(String.valueOf(value));
    }

    /** A JSON array, or a comma-separated string as older connections may hold. */
    private static List<String> recipients(Object value) {
        List<String> recipients = new ArrayList<>();
        if (value instanceof Iterable<?> items) {
            items.forEach(item -> recipients.add(String.valueOf(item)));
        } else if (value != null) {
            for (String part : String.valueOf(value).split(",")) {
                if (!part.isBlank()) {
                    recipients.add(part.trim());
                }
            }
        }
        return recipients;
    }
}
