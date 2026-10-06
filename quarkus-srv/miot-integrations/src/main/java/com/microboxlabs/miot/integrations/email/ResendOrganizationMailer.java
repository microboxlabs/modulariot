package com.microboxlabs.miot.integrations.email;

import com.microboxlabs.miot.core.mail.Mail;
import com.microboxlabs.miot.core.mail.MailDelivery;
import com.microboxlabs.miot.core.mail.OrganizationMailer;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/** Sends an organization's email through its active RESEND connection. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class ResendOrganizationMailer implements OrganizationMailer {

    private final ResendEmailSender sender;

    @Inject
    public ResendOrganizationMailer(ResendEmailSender sender) {
        this.sender = sender;
    }

    @Override
    public Uni<MailDelivery> send(Organization organization, Mail mail, String idempotencyKey) {
        String tenantCode = organization.tenantClientId;
        return Uni.createFrom().item(() -> deliver(tenantCode, mail, idempotencyKey))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private MailDelivery deliver(String tenantCode, Mail mail, String idempotencyKey) {
        if (!sender.configured(tenantCode)) {
            return MailDelivery.notConfigured("No active RESEND connection");
        }
        SendResult result = sender.send(tenantCode,
                new EmailMessage(null, mail.to(), mail.subject(), mail.text(), mail.html(), null), idempotencyKey);
        return result.accepted() ? MailDelivery.sent() : MailDelivery.failed(result.error());
    }
}
