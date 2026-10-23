package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.client.MetaTemplatesClient;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.regex.Pattern;

/**
 * The message templates on the WABA of the organization's WhatsApp connection, read and written live
 * against Meta: nothing is stored here. Meta reviews a new or edited template; its status shows on the next
 * read.
 */
@ApplicationScoped
public class WhatsAppTemplatesService {

    private static final String WABA_ID = "waba_id";
    private static final String TOKEN = "token";
    private static final Pattern TEMPLATE_ID = Pattern.compile("\\d{1,30}");
    private static final Pattern NAME = Pattern.compile("[a-z0-9_]{1,512}");

    private final Function<String, ResolvedConnection> connections;
    private final MetaTemplatesClient meta;

    @Inject
    public WhatsAppTemplatesService(IntegrationConnectionResolver resolver, MetaTemplatesClient meta) {
        this(tenant -> resolver.resolve(tenant, ProviderType.WHATSAPP), meta);
    }

    public WhatsAppTemplatesService(Function<String, ResolvedConnection> connections, MetaTemplatesClient meta) {
        this.connections = connections;
        this.meta = meta;
    }

    private record Waba(ResolvedConnection connection, String wabaId, String token) {
    }

    /** Every template on the WABA, by name then language. */
    public List<WhatsAppTemplate> list(String tenant) {
        Waba waba = waba(tenant);
        return meta.list(waba.connection().baseUrl(), waba.wabaId(), waba.token()).stream()
                .map(WhatsAppTemplate::from)
                .sorted(Comparator.comparing((WhatsAppTemplate t) -> String.valueOf(t.name()))
                        .thenComparing(t -> String.valueOf(t.language())))
                .toList();
    }

    /** Submits a new template for Meta's review. */
    public WhatsAppTemplate create(String tenant, WhatsAppTemplateDraft draft) {
        if (draft == null) {
            throw new IllegalArgumentException("name, category and body are required");
        }
        draft.validateNew();
        Waba waba = waba(tenant);
        JsonObject created = meta.create(waba.connection().baseUrl(), waba.wabaId(), waba.token(), draft.toCreate());
        // Meta may move the template to another category on submit.
        return draft.toTemplate(created.getString("id"), created.getString("status", "PENDING"),
                created.getString("category"));
    }

    /** Changes the category or components of a template; its name and language stay. */
    public WhatsAppTemplate edit(String tenant, String templateId, WhatsAppTemplateDraft draft) {
        checkId(templateId);
        if (draft == null) {
            throw new IllegalArgumentException("category and body are required");
        }
        draft.validate();
        Waba waba = waba(tenant);
        // The token may reach other WABAs; only a template on this connection's WABA may change.
        boolean onWaba = meta.list(waba.connection().baseUrl(), waba.wabaId(), waba.token()).stream()
                .anyMatch(t -> templateId.equals(t.getString("id")));
        if (!onWaba) {
            throw new NoSuchElementException("No template " + templateId + " on the WhatsApp account");
        }
        meta.edit(waba.connection().baseUrl(), templateId, waba.token(), draft.toEdit());
        return WhatsAppTemplate.from(meta.get(waba.connection().baseUrl(), templateId, waba.token()));
    }

    /** Deletes the template by name, in every language, or only the one with {@code templateId}. */
    public void delete(String tenant, String name, String templateId) {
        if (name == null || !NAME.matcher(name).matches()) {
            throw new IllegalArgumentException("name: lowercase letters, digits and underscores only");
        }
        if (templateId != null) {
            checkId(templateId);
        }
        Waba waba = waba(tenant);
        meta.delete(waba.connection().baseUrl(), waba.wabaId(), waba.token(), name, templateId);
    }

    private static void checkId(String templateId) {
        if (templateId == null || !TEMPLATE_ID.matcher(templateId).matches()) {
            throw new IllegalArgumentException("id: Meta's numeric template id");
        }
    }

    private Waba waba(String tenant) {
        ResolvedConnection connection = connections.apply(tenant);
        String wabaId = connection.metadataString(WABA_ID);
        String token = connection.secretString(TOKEN);
        if (wabaId == null || wabaId.isBlank()) {
            throw new ConnectionResolutionException("The WhatsApp connection has no waba_id");
        }
        if (token == null || token.isBlank()) {
            throw new ConnectionResolutionException("The WhatsApp connection has no access token");
        }
        return new Waba(connection, wabaId.trim(), token);
    }
}
