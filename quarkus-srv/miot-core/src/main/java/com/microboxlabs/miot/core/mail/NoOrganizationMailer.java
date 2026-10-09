package com.microboxlabs.miot.core.mail;

import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.arc.DefaultBean;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

/** Used when the integrations module is not in the build: no email. */
@ApplicationScoped
@DefaultBean
public class NoOrganizationMailer implements OrganizationMailer {

    @Override
    public Uni<MailDelivery> send(Organization organization, Mail mail, String idempotencyKey) {
        return Uni.createFrom().item(MailDelivery.notConfigured("Email is not available in this build"));
    }
}
