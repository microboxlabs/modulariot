package com.microboxlabs.miot.core.mail;

import com.microboxlabs.miot.core.model.Organization;
import io.smallrye.mutiny.Uni;

/**
 * Sends email through the organization's own mail connection, else the platform's. Returns
 * {@code NOT_CONFIGURED} when neither exists; never fails the Uni for a provider error.
 */
public interface OrganizationMailer {

    /** {@code idempotencyKey}: the same key within 24 hours does not send twice. */
    Uni<MailDelivery> send(Organization organization, Mail mail, String idempotencyKey);
}
