package com.microboxlabs.miot.conversational.jobs;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.arc.properties.IfBuildProperty;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplatesService;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.core.mail.MailDelivery;
import com.microboxlabs.miot.core.mail.OrganizationMailer;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.geocoding.GeocodingQuotaMail;
import com.microboxlabs.miot.integrations.geocoding.GeocodingQuotaNotification;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class GeocodingQuotaNotificationHandler implements ModulithJobHandler {

    private static final Logger LOG = Logger.getLogger(GeocodingQuotaNotificationHandler.class);
    private final ObjectMapper mapper;
    private final OrganizationMailer mailer;
    private final PlatformMailService platformMail;
    private final WhatsAppMessagingService messaging;
    private final WhatsAppTemplatesService metaTemplates;
    private final TemplateStore templates;
    private final IntegrationConnectionRepository connections;
    private final Optional<String> publicUrl;

    @Inject
    GeocodingQuotaNotificationHandler(ObjectMapper mapper, OrganizationMailer mailer, PlatformMailService platformMail,
            WhatsAppMessagingService messaging, WhatsAppTemplatesService metaTemplates, TemplateStore templates,
            IntegrationConnectionRepository connections,
            @ConfigProperty(name = "miot.app.public-url") Optional<String> publicUrl) {
        this.mapper = mapper;
        this.mailer = mailer;
        this.platformMail = platformMail;
        this.messaging = messaging;
        this.metaTemplates = metaTemplates;
        this.templates = templates;
        this.connections = connections;
        this.publicUrl = publicUrl.map(String::trim).filter(s -> !s.isEmpty());
    }

    @Override
    public String jobType() {
        return GeocodingQuotaNotification.JOB_TYPE;
    }

    @Override
    public JobOutcome handle(String rowTenantCode, Map<String, Object> payload) {
        GeocodingQuotaNotification n;
        try {
            n = mapper.convertValue(payload, GeocodingQuotaNotification.class);
            if (n.tenantCode() == null || !n.tenantCode().equals(rowTenantCode) || n.organization() == null
                    || n.month() == null || n.level() == null || n.platformEmails() == null || n.adminEmails() == null
                    || n.platformWhatsAppRecipients() == null || n.orgWhatsAppRecipients() == null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid geocoding quota notification payload");
        }
        Results results = new Results();
        Organization org = new Organization();
        org.id = n.organizationId();
        org.slug = n.organization();
        org.name = n.organizationName();
        org.tenantClientId = n.tenantCode();
        var owners = new LinkedHashSet<>(n.platformEmails());
        for (String email : owners) {
            results.deliver("email " + maskEmail(email), () -> platformMail.send(
                    GeocodingQuotaMail.mail(n, email, publicUrl.orElse(null)), emailKey(n, "platform", email)).status()
                    == MailDelivery.Status.SENT);
        }
        var admins = new LinkedHashSet<>(n.adminEmails());
        admins.removeAll(owners);
        for (String email : admins) {
            results.deliver("email " + maskEmail(email), () -> mailer.send(org,
                    GeocodingQuotaMail.mail(n, email, publicUrl.orElse(null)), emailKey(n, "org", email))
                    .await().atMost(Duration.ofSeconds(30)).status() == MailDelivery.Status.SENT);
        }
        whatsapp(n, n.tenantCode(), n.orgWhatsAppRecipients(), false, results);
        whatsapp(n, PlatformScope.TENANT, n.platformWhatsAppRecipients(), true, results);
        return results.outcome();
    }

    private void whatsapp(GeocodingQuotaNotification n, String tenant, List<String> phones, boolean platform,
            Results results) {
        if (phones.isEmpty()) {
            return;
        }
        try {
            if (platform && connections.findActiveByProvider(tenant, ProviderType.WHATSAPP) == null) {
                String skipped = "Platform WhatsApp recipients skipped: no platform WhatsApp connection";
                LOG.info(skipped);
                results.skipped.add(skipped);
                return;
            }
        } catch (RuntimeException e) {
            for (String phone : new LinkedHashSet<>(phones)) {
                results.deliver("WhatsApp " + maskPhone(phone), () -> { throw e; });
            }
            return;
        }
        ConvTemplate.WhatsApp template = approvedTemplate(tenant);
        for (String phone : new LinkedHashSet<>(phones)) {
            results.deliver("WhatsApp " + maskPhone(phone), () -> messaging.send(tenant,
                    request(n, phone, template), "geocoding-quota-notifier").status() != MessageStatus.FAILED);
        }
    }

    private ConvTemplate.WhatsApp approvedTemplate(String tenant) {
        try {
            var configured = templates.find(ConvTemplate.PLATFORM_TENANT, GeocodingQuotaNotification.TEMPLATE_NAME)
                    .map(ConvTemplate::whatsapp).orElse(null);
            if (configured == null) {
                return null;
            }
            return metaTemplates.list(tenant).stream().anyMatch(t -> configured.metaName().equals(t.name())
                    && configured.language().equals(t.language()) && "APPROVED".equals(t.status())) ? configured : null;
        } catch (RuntimeException e) {
            LOG.infof("Geocoding quota template unavailable (%s); using text in the 24h window",
                    e.getClass().getSimpleName());
            return null;
        }
    }

    private static SendWhatsAppMessageRequest request(GeocodingQuotaNotification n, String phone,
            ConvTemplate.WhatsApp template) {
        if (template != null) {
            return new SendWhatsAppMessageRequest(phone, "TEMPLATE", null, template.metaName(), template.language(),
                    GeocodingQuotaMail.templateParams(n), null, null, null, null, null, null);
        }
        return new SendWhatsAppMessageRequest(phone, "TEXT", GeocodingQuotaMail.text(n), null, null, null,
                null, null, null, null, null, null);
    }

    private static String emailKey(GeocodingQuotaNotification n, String audience, String email) {
        return n.idempotencyKey() + ":" + audience + ":"
                + UUID.nameUUIDFromBytes(email.getBytes(StandardCharsets.UTF_8));
    }

    private static String maskEmail(String email) {
        return email == null || email.isEmpty() ? "***@***" : email.charAt(0) + "***@***";
    }

    private static String maskPhone(String phone) {
        return phone == null || phone.length() <= 4 ? "****" : "****" + phone.substring(phone.length() - 4);
    }

    private static final class Results {
        int sent;
        int attempted;
        final List<String> failures = new ArrayList<>();
        final List<String> skipped = new ArrayList<>();

        void deliver(String recipient, Supplier<Boolean> send) {
            attempted++;
            try {
                if (Boolean.TRUE.equals(send.get())) {
                    sent++;
                    return;
                }
                failures.add(recipient + ": delivery failed");
            } catch (RuntimeException e) {
                failures.add(recipient + ": " + e.getClass().getSimpleName());
            }
            LOG.warnf("Geocoding quota notification failed: %s", failures.get(failures.size() - 1));
        }

        JobOutcome outcome() {
            String detail = "Delivered " + sent + "/" + attempted
                    + (failures.isEmpty() ? "" : "; failed: " + String.join("; ", failures))
                    + (skipped.isEmpty() ? "" : "; " + String.join("; ", skipped));
            if (attempted > 0 && sent == 0) {
                throw new IllegalStateException(detail);
            }
            return JobOutcome.succeeded(detail + (attempted == 0 ? "; no delivery recipients" : ""));
        }
    }
}
