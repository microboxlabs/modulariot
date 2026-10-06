package com.microboxlabs.miot.integrations.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.core.mail.Mail;
import com.microboxlabs.miot.core.mail.MailDelivery;
import com.microboxlabs.miot.core.model.Organization;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class ResendOrganizationMailerTest {

    private final Mail mail = new Mail("ana@example.test", "Hi", "Plain", "<p>Hi</p>");

    @Test
    void anOrganizationWithoutAConnectionIsNotConfigured() {
        MailDelivery delivery = mailer(false, SendResult.accepted(200, "x"), new AtomicReference<>())
                .send(org("t1"), mail, "k").await().indefinitely();

        assertEquals(MailDelivery.Status.NOT_CONFIGURED, delivery.status());
    }

    @Test
    void anAcceptedEmailIsSentAndUsesTheConnectionsSender() {
        AtomicReference<EmailMessage> seen = new AtomicReference<>();
        MailDelivery delivery = mailer(true, SendResult.accepted(200, "id-1"), seen)
                .send(org("t1"), mail, "k").await().indefinitely();

        assertEquals(MailDelivery.Status.SENT, delivery.status());
        assertNull(seen.get().from());
        assertEquals("ana@example.test", seen.get().to());
        assertEquals("<p>Hi</p>", seen.get().html());
    }

    @Test
    void aRejectedEmailFailsWithResendsReason() {
        MailDelivery delivery = mailer(true, SendResult.failed(422, "Resend returned HTTP 422"), new AtomicReference<>())
                .send(org("t1"), mail, "k").await().indefinitely();

        assertEquals(MailDelivery.Status.FAILED, delivery.status());
        assertEquals("Resend returned HTTP 422", delivery.detail());
    }

    private static ResendOrganizationMailer mailer(boolean configured, SendResult result,
            AtomicReference<EmailMessage> seen) {
        return new ResendOrganizationMailer(new ResendEmailSender(null, null, null) {
            @Override
            public boolean configured(String tenantCode) {
                return configured;
            }

            @Override
            public SendResult send(String tenantCode, EmailMessage message, String idempotencyKey) {
                seen.set(message);
                return result;
            }
        });
    }

    private static Organization org(String tenantClientId) {
        Organization organization = new Organization();
        organization.tenantClientId = tenantClientId;
        return organization;
    }
}
