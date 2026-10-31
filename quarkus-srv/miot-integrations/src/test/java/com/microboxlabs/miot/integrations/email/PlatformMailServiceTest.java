package com.microboxlabs.miot.integrations.email;

import static org.junit.jupiter.api.Assertions.*;

import com.microboxlabs.miot.core.mail.Mail;
import com.microboxlabs.miot.core.mail.MailDelivery;
import org.junit.jupiter.api.Test;

class PlatformMailServiceTest {
    private final Mail mail = new Mail("owner@example.com", "Quota", "Plain text", "<p>Plain text</p>");

    private static final class Sender extends ResendEmailSender {
        boolean configured = true;
        String tenant;
        String key;
        EmailMessage message;
        SendResult result = SendResult.accepted(200, "email-1");

        Sender() { super(null, null, null); }

        public boolean configured(String code) {
            tenant = code;
            return configured;
        }

        public SendResult send(String code, EmailMessage email, String idempotencyKey) {
            tenant = code;
            message = email;
            key = idempotencyKey;
            return result;
        }
    }

    @Test
    void ownersAlwaysUseThePlatformSenderAndAnIdempotencyKey() {
        var sender = new Sender();
        var delivery = new PlatformMailService(null, null, null, null, sender).send(mail, "quota-key");
        assertEquals(MailDelivery.Status.SENT, delivery.status());
        assertEquals("_platform", sender.tenant);
        assertEquals("quota-key", sender.key);
        assertEquals("owner@example.com", sender.message.to());
        assertNull(sender.message.from());
    }

    @Test
    void missingPlatformSenderIsNotConfigured() {
        var sender = new Sender();
        sender.configured = false;
        assertEquals(MailDelivery.Status.NOT_CONFIGURED,
                new PlatformMailService(null, null, null, null, sender).send(mail, "quota-key").status());
        assertNull(sender.message);
    }

    @Test
    void providerFailureIsReturnedToTheJob() {
        var sender = new Sender();
        sender.result = SendResult.failedPermanently("synthetic provider failure");
        assertEquals(MailDelivery.Status.FAILED,
                new PlatformMailService(null, null, null, null, sender).send(mail, "quota-key").status());
    }
}
