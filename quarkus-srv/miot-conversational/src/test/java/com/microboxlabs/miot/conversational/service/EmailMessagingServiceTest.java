package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.accounts.InMemoryChannelAccounts;
import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.core.mail.MailTemplates;
import com.microboxlabs.miot.core.mail.NotificationMail;
import com.microboxlabs.miot.integrations.email.EmailMessage;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.email.ResendEmailSender;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.email.SendResult;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** A rule's email: which sender, what is stored, and on which conversation. */
class EmailMessagingServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String TOWER = "tower@example.com";
    private static final String RUN = "00000000-0000-0000-0000-0000000000a1";

    private final InMemoryConversations store = new InMemoryConversations();
    private final List<String> sendingTenants = new ArrayList<>();
    private final List<EmailMessage> sent = new ArrayList<>();
    private final List<String> keys = new ArrayList<>();

    private final InMemoryChannelAccounts accounts = new InMemoryChannelAccounts();

    /** {@code configured}: the tenants with an active RESEND connection; the tenant's mode is OWN when it has one. */
    private EmailMessagingService service(Set<String> configured, SendResult result) {
        if (configured.contains(TENANT)) {
            accounts.connect(TENANT, ProviderType.RESEND).own(TENANT, "email");
        }
        return new EmailMessagingService(new ResendEmailSender(null, null, null) {
            @Override
            public boolean configured(String tenantCode) {
                return configured.contains(tenantCode);
            }

            @Override
            public SendResult send(String tenantCode, EmailMessage message, String idempotencyKey) {
                sendingTenants.add(tenantCode);
                sent.add(message);
                keys.add(idempotencyKey);
                return result;
            }
        }, store.conversationRepository, store.messageRepository, accounts.service,
                new NotificationMail(Optional.empty(), new MailTemplates(Optional.empty())));
    }

    private static ContextMessage email(String subject, String body) {
        return new ContextMessage(ContextKind.SYMPTOM_CASE, "-7", TOWER, "Jefe de torre", null, null, "panic-tower",
                null, Map.of(), subject, body, RUN, 1);
    }

    @Test
    void theTenantsConnectionSendsAndTheMessageLandsOnTheCaseConversation() {
        Message m = service(Set.of(TENANT), SendResult.accepted(200, "re-1"))
                .sendInContext(TENANT, email("Pánico", "Sin respuesta"), false);

        assertEquals(List.of(TENANT), sendingTenants);
        assertEquals(TOWER, sent.get(0).to());
        assertEquals("Pánico", sent.get(0).subject());
        assertEquals("Sin respuesta", sent.get(0).text());
        assertNull(sent.get(0).replyTo());
        assertEquals(RUN + ":1:" + TOWER, keys.get(0));
        assertEquals(MessageStatus.SENT, m.status());
        assertEquals(Channel.EMAIL, m.channel());
        assertEquals("re-1", m.providerMessageId());
        assertEquals(RUN, m.runId());
        assertEquals(1, m.step());
        assertEquals("Pánico", m.metadata().get("subject"));
        Conversation c = store.conversations.get(m.conversationId());
        assertEquals(ContextKind.SYMPTOM_CASE, c.contextKind());
        assertEquals("-7", c.contextKey());
        assertEquals(TOWER, c.participantAddress());
        assertNull(c.phoneE164());
        assertEquals("Jefe de torre", c.displayName());
        assertEquals("Pánico", c.lastMessagePreview());
    }

    @Test
    void anHtmlBodyIsSentInsideTheLayoutAndTheTextIsStored() {
        ContextMessage html = new ContextMessage(ContextKind.SYMPTOM_CASE, "-7", TOWER, "Jefe de torre", null, null,
                "panic-tower", null, Map.of(), "Pánico", "Sin respuesta", RUN, 1, "<p>Sin <b>respuesta</b></p>");
        Message m = service(Set.of(TENANT), SendResult.accepted(200, "re-1")).sendInContext(TENANT, html, false);

        assertEquals("Sin respuesta", sent.get(0).text());
        assertTrue(sent.get(0).html().startsWith("<!DOCTYPE html>"), sent.get(0).html());
        assertTrue(sent.get(0).html().contains("<p>Sin <b>respuesta</b></p>"));
        assertTrue(sent.get(0).html().contains("<title>Pánico</title>"));
        assertEquals("Sin respuesta", m.body());
        assertEquals("<p>Sin <b>respuesta</b></p>", m.metadata().get("html"));
    }

    @Test
    void thePlatformSendsWhenTheTenantUsesThePlatformsAccount() {
        service(Set.of(PlatformMailService.PLATFORM_TENANT), SendResult.accepted(200, "re-1"))
                .sendInContext(TENANT, email("Pánico", "x"), false);

        assertEquals(List.of(PlatformMailService.PLATFORM_TENANT), sendingTenants);
    }

    @Test
    void withoutASenderOrWithARefusalTheMessageIsFailed() {
        Message none = service(Set.of(), SendResult.accepted(200, "x")).sendInContext(TENANT, email("a", "b"), false);
        assertEquals(MessageStatus.FAILED, none.status());
        assertTrue(none.errorMessage().contains("platform has no email account"));

        Message refused = service(Set.of(TENANT), SendResult.failed(422, "Resend returned HTTP 422"))
                .sendInContext(TENANT, email("a", "b"), false);
        assertEquals(MessageStatus.FAILED, refused.status());
        assertEquals("Resend returned HTTP 422", refused.errorMessage());

        Message blank = service(Set.of(TENANT), SendResult.accepted(200, "x"))
                .sendInContext(TENANT, email("", "b"), false);
        assertEquals(MessageStatus.FAILED, blank.status());
        assertEquals(1, sent.size(), "only the refused one reached Resend");
        assertEquals(1, store.conversations.size(), "one conversation per context and address");
    }

    @Test
    void aSimulatedEmailIsStoredAndNotSent() {
        Message m = service(Set.of(TENANT), SendResult.accepted(200, "x"))
                .sendInContext(TENANT, email("a", "b"), true);

        assertEquals(MessageStatus.SIMULATED, m.status());
        assertTrue(sent.isEmpty());
    }

    @Test
    void aConfigurationFailureParksAndManualRetryCanSendTheFailedMessage() {
        EmailMessagingService unavailable = service(Set.of(TENANT),
                SendResult.failedPermanently("Invalid sender"));
        Message queued = unavailable.queueInContext(TENANT, email("Subject", "Body"));
        String messageId = queued.id();
        SendFailure failure = assertThrows(SendFailure.class,
                () -> unavailable.deliverQueued(TENANT, messageId));
        assertFalse(failure.retryable());
        store.messageRepository.markStatus(queued.id(), MessageStatus.FAILED, null, null,
                failure.getMessage(), Set.of(MessageStatus.PENDING));

        EmailMessagingService repaired = service(Set.of(TENANT), SendResult.accepted(200, "re-fixed"));
        Message sentAfterRetry = repaired.deliverQueued(TENANT, queued.id());
        assertEquals(MessageStatus.SENT, sentAfterRetry.status());
        assertEquals("re-fixed", sentAfterRetry.providerMessageId());
        assertEquals(1, store.messages.size());
    }

    @Test
    void aRetriedStepGetsTheEmailAlreadySentInsteadOfStoringItTwice() {
        EmailMessagingService service = service(Set.of(TENANT), SendResult.accepted(200, "re-1"));
        Message first = service.sendInContext(TENANT, email("Pánico", "Sin respuesta"), false);
        Message retried = service.sendInContext(TENANT, email("Pánico", "Sin respuesta"), false);

        assertEquals(first.id(), retried.id());
        assertEquals(List.of(RUN + ":1:" + TOWER, RUN + ":1:" + TOWER), keys);
        assertEquals(1, store.conversationRepository.outboundTouches);
    }

    @Test
    void aConcurrentRetryConflictReturnsTheStoredEmailWithoutAnotherPreviewTouch() {
        EmailMessagingService service = service(Set.of(TENANT), SendResult.accepted(200, "re-1"));
        Message first = service.sendInContext(TENANT, email("Pánico", "Sin respuesta"), false);
        store.messageRepository.hideNextProviderLookup = true;

        Message retried = service.sendInContext(TENANT, email("Pánico", "Sin respuesta"), false);

        assertEquals(first.id(), retried.id());
        assertEquals(1, store.messages.size());
        assertEquals(1, store.conversationRepository.outboundTouches);
    }
}
