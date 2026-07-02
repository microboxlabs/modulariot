package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * Parses representative Meta webhook envelopes. Phone numbers are placeholders only — never real
 * numbers in tests.
 */
class MetaWebhookParserTest {

    private static ParsedWebhook parse(String json) {
        return MetaWebhookParser.parse(json.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void parsesAnInboundTextMessageAndNormalizesTheSender() {
        String json = """
                {"object":"whatsapp_business_account","entry":[{"id":"WABA1","changes":[{"field":"messages",
                "value":{"messaging_product":"whatsapp",
                "metadata":{"display_phone_number":"15551234","phone_number_id":"PNID_42"},
                "contacts":[{"profile":{"name":"Juan Perez"},"wa_id":"56900000001"}],
                "messages":[{"from":"56900000001","id":"wamid.TXT","timestamp":"1719792000","type":"text",
                "text":{"body":"Ahi va la foto"}}]}}]}]}
                """;
        ParsedWebhook parsed = parse(json);

        assertEquals(1, parsed.messages().size());
        assertTrue(parsed.statuses().isEmpty());
        InboundMessage m = parsed.messages().get(0);
        assertEquals("PNID_42", m.phoneNumberId());
        assertEquals("+56900000001", m.fromE164());
        assertEquals("Juan Perez", m.contactName());
        assertEquals("wamid.TXT", m.wamid());
        assertEquals(MessageType.TEXT, m.type());
        assertEquals("Ahi va la foto", m.body());
        assertNull(m.mediaRef());
        assertEquals(Instant.ofEpochSecond(1719792000L), m.timestamp().toInstant());
    }

    @Test
    void parsesAnInboundImageWithMediaRefAndCaption() {
        String json = """
                {"entry":[{"changes":[{"value":{
                "metadata":{"phone_number_id":"PNID_42"},
                "contacts":[{"profile":{"name":"Juan"},"wa_id":"56900000001"}],
                "messages":[{"from":"56900000001","id":"wamid.IMG","timestamp":"1719792100","type":"image",
                "image":{"id":"MEDIA_9","mime_type":"image/jpeg","caption":"POD firmado"}}]}}]}]}
                """;
        InboundMessage m = parse(json).messages().get(0);
        assertEquals(MessageType.IMAGE, m.type());
        assertEquals("MEDIA_9", m.mediaRef());
        assertEquals("image/jpeg", m.mediaMimeType());
        assertEquals("POD firmado", m.body());
    }

    @Test
    void parsesADeliveredStatusCallback() {
        String json = """
                {"entry":[{"changes":[{"value":{
                "metadata":{"phone_number_id":"PNID_42"},
                "statuses":[{"id":"wamid.OUT1","status":"delivered","timestamp":"1719792200",
                "recipient_id":"56900000001"}]}}]}]}
                """;
        ParsedWebhook parsed = parse(json);
        assertTrue(parsed.messages().isEmpty());
        assertEquals(1, parsed.statuses().size());
        StatusUpdate s = parsed.statuses().get(0);
        assertEquals("wamid.OUT1", s.wamid());
        assertEquals(MessageStatus.DELIVERED, s.status());
        assertEquals("+56900000001", s.recipientE164());
        assertNull(s.error());
    }

    @Test
    void parsesAFailedStatusWithErrorDetail() {
        String json = """
                {"entry":[{"changes":[{"value":{"statuses":[{"id":"wamid.OUT2","status":"failed",
                "timestamp":"1719792300","recipient_id":"56900000001",
                "errors":[{"code":131026,"title":"Message undeliverable"}]}]}}]}]}
                """;
        StatusUpdate s = parse(json).statuses().get(0);
        assertEquals(MessageStatus.FAILED, s.status());
        assertEquals("Message undeliverable (131026)", s.error());
    }

    @Test
    void dropsUnknownStatusValues() {
        String json = """
                {"entry":[{"changes":[{"value":{"statuses":[{"id":"wamid.X","status":"deleted",
                "timestamp":"1719792300"}]}}]}]}
                """;
        assertTrue(parse(json).statuses().isEmpty());
    }

    @Test
    void malformedOrEmptyBodyYieldsNoEvents() {
        ParsedWebhook malformed = parse("not json {");
        assertTrue(malformed.messages().isEmpty());
        assertTrue(malformed.statuses().isEmpty());

        ParsedWebhook empty = MetaWebhookParser.parse(new byte[0]);
        assertTrue(empty.messages().isEmpty());
        assertTrue(empty.statuses().isEmpty());

        ParsedWebhook nullBody = MetaWebhookParser.parse(null);
        assertTrue(nullBody.messages().isEmpty());
    }

    @Test
    void typeAndStatusAndPhoneMappersAreExhaustiveOnKnownValues() {
        assertEquals(MessageType.TEXT, MetaWebhookParser.mapType("text"));
        assertEquals(MessageType.DOCUMENT, MetaWebhookParser.mapType("document"));
        assertEquals(MessageType.UNKNOWN, MetaWebhookParser.mapType("contacts"));
        assertEquals(MessageType.UNKNOWN, MetaWebhookParser.mapType(null));

        assertEquals(MessageStatus.READ, MetaWebhookParser.mapStatus("read"));
        assertNull(MetaWebhookParser.mapStatus("queued"));

        assertEquals("+56900000001", MetaWebhookParser.toE164("56 9 0000-0001"));
        assertNull(MetaWebhookParser.toE164(null));
        assertNull(MetaWebhookParser.toE164("not-a-number"));
    }
}
