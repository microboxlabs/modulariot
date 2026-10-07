package com.microboxlabs.miot.integrations.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.core.mail.Mail;
import com.microboxlabs.miot.core.mail.MailDelivery;
import com.microboxlabs.miot.core.model.Organization;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class ResendOrganizationMailerTest {

    private static final String PLATFORM = PlatformMailService.PLATFORM_TENANT;

    private final Mail mail = new Mail("ana@example.test", "Hi", "Plain", "<p>Hi</p>");
    private final AtomicReference<EmailMessage> seen = new AtomicReference<>();
    private final AtomicReference<String> usedTenant = new AtomicReference<>();

    @Test
    void withNoSenderAnywhereItIsNotConfigured() {
        MailDelivery delivery = mailer(Set.of(), SendResult.accepted(200, "x"))
                .send(org("t1"), mail, "k").await().indefinitely();

        assertEquals(MailDelivery.Status.NOT_CONFIGURED, delivery.status());
        assertNull(usedTenant.get());
    }

    @Test
    void anAcceptedEmailIsSentAndUsesTheConnectionsSender() {
        MailDelivery delivery = mailer(Set.of("t1"), SendResult.accepted(200, "id-1"))
                .send(org("t1"), mail, "k").await().indefinitely();

        assertEquals(MailDelivery.Status.SENT, delivery.status());
        assertNull(seen.get().from());
        assertEquals("ana@example.test", seen.get().to());
        assertEquals("<p>Hi</p>", seen.get().html());
    }

    @Test
    void theOrganizationsOwnSenderComesFirst() {
        mailer(Set.of("t1", PLATFORM), SendResult.accepted(200, "id-1"))
                .send(org("t1"), mail, "k").await().indefinitely();

        assertEquals("t1", usedTenant.get());
    }

    @Test
    void thePlatformSendsWhenTheOrganizationHasNoSender() {
        MailDelivery delivery = mailer(Set.of(PLATFORM), SendResult.accepted(200, "id-1"))
                .send(org("t1"), mail, "k").await().indefinitely();

        assertEquals(MailDelivery.Status.SENT, delivery.status());
        assertEquals(PLATFORM, usedTenant.get());
    }

    @Test
    void aRejectedEmailFailsWithResendsReason() {
        MailDelivery delivery = mailer(Set.of("t1"), SendResult.failed(422, "Resend returned HTTP 422"))
                .send(org("t1"), mail, "k").await().indefinitely();

        assertEquals(MailDelivery.Status.FAILED, delivery.status());
        assertEquals("Resend returned HTTP 422", delivery.detail());
    }

    private ResendOrganizationMailer mailer(Set<String> configured, SendResult result) {
        return new ResendOrganizationMailer(new ResendEmailSender(null, null, null) {
            @Override
            public boolean configured(String tenantCode) {
                return configured.contains(tenantCode);
            }

            @Override
            public SendResult send(String tenantCode, EmailMessage message, String idempotencyKey) {
                usedTenant.set(tenantCode);
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
