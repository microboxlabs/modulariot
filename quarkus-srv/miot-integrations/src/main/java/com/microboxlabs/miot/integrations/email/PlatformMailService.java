package com.microboxlabs.miot.integrations.email;

import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.core.mail.Mail;
import com.microboxlabs.miot.core.mail.MailDelivery;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.PlatformConnectionStore;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * The platform's email sender: one RESEND connection, kept under a reserved tenant code, used for
 * every organization that has no sender of its own. Blocking.
 */
@ApplicationScoped
public class PlatformMailService {

    /**
     * Starts with "_", which organizations may not use as their tenant client id
     * ({@code PlatformOrganizationsResource}), so no organization can own it.
     */
    public static final String PLATFORM_TENANT = PlatformScope.TENANT;
    static final String NAME = "Platform email";

    /** {@code configured} is false and the rest null when no sender is set. */
    public record PlatformMailView(boolean configured, String connectionId, String from, String keyPreview,
            String status, OffsetDateTime lastTestedAt, Boolean lastTestResult) {

        static PlatformMailView none() {
            return new PlatformMailView(false, null, null, null, null, null, null);
        }
    }

    /** {@code apiKey}: required the first time; blank keeps the stored key. */
    public record SetPlatformMailRequest(String from, String apiKey) {
    }

    private final IntegrationConnectionService connections;
    private final PlatformConnectionStore store;
    private final ResendClient client;
    private final ResendEmailSender sender;

    @Inject
    public PlatformMailService(IntegrationConnectionService connections, IntegrationConnectionRepository repository,
            CredentialProfileService credentials, ResendClient client, ResendEmailSender sender) {
        this.connections = connections;
        this.store = new PlatformConnectionStore(connections, repository, credentials, ProviderType.RESEND, NAME);
        this.client = client;
        this.sender = sender;
    }

    public MailDelivery send(Mail mail, String idempotencyKey) {
        if (!sender.configured(PLATFORM_TENANT)) {
            return MailDelivery.notConfigured("No platform email sender");
        }
        SendResult result = sender.send(PLATFORM_TENANT,
                new EmailMessage(null, mail.to(), mail.subject(), mail.text(), mail.html(), null), idempotencyKey);
        return result.accepted() ? MailDelivery.sent() : MailDelivery.failed(result.error());
    }

    public PlatformMailView get() {
        IntegrationConnection connection = store.find();
        return connection == null ? PlatformMailView.none() : view(connection);
    }

    /**
     * Saves the sender. A new key is tested with Resend right away, so the status always describes
     * the key in use.
     *
     * @throws IllegalArgumentException for an invalid sender, or a missing key on first save
     */
    public PlatformMailView put(SetPlatformMailRequest body, String actor) {
        String from = body == null || body.from() == null ? "" : body.from().trim();
        String apiKey = body == null || body.apiKey() == null ? "" : body.apiKey().trim();
        if (!ResendEmailSender.validSender(from)) {
            throw new IllegalArgumentException("from must be address@domain.tld or Name <address@domain.tld>");
        }
        IntegrationConnection existing = store.find();
        String connectionId = existing == null ? create(from, apiKey, actor) : existing.id();
        if (existing != null) {
            connections.updateConnection(PLATFORM_TENANT, connectionId, new UpdateIntegrationConnectionRequest(
                    null, client.baseUrl(), Map.of(ResendEmailSender.FROM, from), null,
                    apiKey.isEmpty() ? null : apiKey));
        }
        if (!apiKey.isEmpty()) {
            store.test(connectionId);
        }
        return get();
    }

    private String create(String from, String apiKey, String actor) {
        if (apiKey.isEmpty()) {
            throw new IllegalArgumentException("apiKey is required");
        }
        // Tagged like an organization's Resend key, so Credenciales shows it as Resend.
        return store.create(AuthType.BEARER_TOKEN, Map.of("provider", "resend"), Map.of(ResendEmailSender.TOKEN, apiKey),
                client.baseUrl(), Map.of(ResendEmailSender.FROM, from), actor);
    }

    /** @return false when no sender was set */
    public boolean delete(String actor) {
        return store.delete(actor);
    }

    /** Checks the stored key with Resend; null when no sender is set. */
    public ConnectionTestResponse test() {
        return store.test();
    }

    private PlatformMailView view(IntegrationConnection connection) {
        Object from = connection.metadata() == null ? null : connection.metadata().get(ResendEmailSender.FROM);
        return new PlatformMailView(true, connection.id(), from instanceof String s ? s : null,
                store.secretPreview(connection),
                connection.status() == null ? null : connection.status().name(),
                connection.lastTestedAt(), connection.lastTestResult());
    }
}
