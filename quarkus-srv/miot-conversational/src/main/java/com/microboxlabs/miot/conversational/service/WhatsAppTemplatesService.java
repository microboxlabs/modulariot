package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.client.MetaGraphException;
import com.microboxlabs.miot.conversational.client.MetaTemplatesClient;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
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
    private static final String APPROVED = "APPROVED";
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

    /** What a copy did with one template. */
    public enum CopyStatus {
        /** Submitted to Meta for review on the organization's account. */
        COPIED,
        /** The account already has a template with this name and language. */
        EXISTS,
        FAILED
    }

    public record CopyResult(String name, String language, CopyStatus status, String error) {
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

    /**
     * Submits the platform's templates, or only those in {@code names}, to the WABA of the organization's own
     * WhatsApp connection, where Meta reviews them again. A template already there with the same name and
     * language is left as it is. Only the platform's approved templates are copied, and only those with a text
     * header or none; a named template Meta has not approved is reported as failed.
     */
    public List<CopyResult> copyFromPlatform(String tenant, List<String> names) {
        if (PlatformScope.TENANT.equals(tenant)) {
            throw new IllegalArgumentException("The platform's templates are the ones copied");
        }
        Waba target = waba(tenant);
        Set<String> existing = meta.list(target.connection().baseUrl(), target.wabaId(), target.token()).stream()
                .map(t -> t.getString("name") + "/" + t.getString("language"))
                .collect(Collectors.toSet());
        Set<String> wanted = names == null || names.isEmpty() ? null : new LinkedHashSet<>(names);
        Set<String> found = new LinkedHashSet<>();
        List<CopyResult> out = new ArrayList<>();
        for (WhatsAppTemplate t : list(PlatformScope.TENANT)) {
            if (wanted == null || wanted.contains(t.name())) {
                found.add(t.name());
                copyIfApproved(tenant, t, existing, wanted != null).ifPresent(out::add);
            }
        }
        if (wanted != null) {
            wanted.stream().filter(n -> !found.contains(n)).forEach(n -> out.add(new CopyResult(n, null,
                    CopyStatus.FAILED, "The platform's account has no template " + n)));
        }
        return out;
    }

    /** An unapproved template is skipped, or reported as failed when it was named. */
    private Optional<CopyResult> copyIfApproved(String tenant, WhatsAppTemplate t, Set<String> existing,
            boolean named) {
        if (APPROVED.equals(t.status())) {
            return Optional.of(copy(tenant, t, existing.contains(t.name() + "/" + t.language())));
        }
        return named
                ? Optional.of(new CopyResult(t.name(), t.language(), CopyStatus.FAILED,
                        "The platform's template is " + t.status() + ", not approved"))
                : Optional.empty();
    }

    private CopyResult copy(String tenant, WhatsAppTemplate t, boolean exists) {
        if (exists) {
            return new CopyResult(t.name(), t.language(), CopyStatus.EXISTS, null);
        }
        if (t.headerFormat() != null && !"TEXT".equals(t.headerFormat())) {
            return new CopyResult(t.name(), t.language(), CopyStatus.FAILED,
                    "Only templates with a text header can be copied; create it in Meta");
        }
        try {
            create(tenant, new WhatsAppTemplateDraft(t.name(), t.language(), t.category(), t.header(), t.body(),
                    t.footer(), t.buttons(), t.examples()));
            return new CopyResult(t.name(), t.language(), CopyStatus.COPIED, null);
        } catch (IllegalArgumentException | MetaGraphException e) {
            return new CopyResult(t.name(), t.language(), CopyStatus.FAILED, e.getMessage());
        }
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
