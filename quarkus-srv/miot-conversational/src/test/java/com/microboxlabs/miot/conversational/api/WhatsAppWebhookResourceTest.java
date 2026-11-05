package com.microboxlabs.miot.conversational.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.jobs.WhatsAppWebhookJobs;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.service.WhatsAppWebhookKeys;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

/** The webhook checks each request against the keys of the connection its URL names. */
class WhatsAppWebhookResourceTest {

    private static final String TOKEN = "the-configured-verify-token";
    private static final String CONNECTION = "conn-1";
    private static final String SECRET = "app-secret-1";
    private static final byte[] DELIVERY = """
            {"entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"PNID_ORG"},
             "messages":[{"from":"56900000001","id":"wamid.IN1","timestamp":"1719792000","type":"text",
                          "text":{"body":"hola"}}]}}]}]}
            """.getBytes(StandardCharsets.UTF_8);

    private final List<String> enqueuedFor = new ArrayList<>();
    private final WhatsAppWebhookJobs jobs = new WhatsAppWebhookJobs((tenant, request) -> {
        enqueuedFor.add(tenant);
        return new EnqueueJobsResponse(List.of(), 0);
    }, r -> {
    }, pnid -> "org-a", wamid -> null);
    private final WhatsAppWebhookResource resource = new WhatsAppWebhookResource(id -> CONNECTION.equals(id)
            ? Optional.of(new WhatsAppWebhookKeys("org-a", CONNECTION, SECRET, TOKEN))
            : Optional.empty(), jobs);

    @Test
    void acceptsSubscribeWithMatchingToken() {
        assertTrue(WhatsAppWebhookResource.isValidHandshake("subscribe", TOKEN, TOKEN));
    }

    @Test
    void rejectsWrongToken() {
        assertFalse(WhatsAppWebhookResource.isValidHandshake("subscribe", "guessed", TOKEN));
    }

    @Test
    void rejectsNonSubscribeMode() {
        assertFalse(WhatsAppWebhookResource.isValidHandshake("unsubscribe", TOKEN, TOKEN));
        assertFalse(WhatsAppWebhookResource.isValidHandshake(null, TOKEN, TOKEN));
    }

    @Test
    void rejectsWhenConfiguredTokenIsBlankOrPresentedTokenIsNull() {
        assertFalse(WhatsAppWebhookResource.isValidHandshake("subscribe", "", ""));
        assertFalse(WhatsAppWebhookResource.isValidHandshake("subscribe", null, TOKEN));
    }

    @Test
    void theHandshakeUsesTheConnectionsVerifyToken() {
        Response ok = resource.verify(CONNECTION, "subscribe", TOKEN, "42");
        assertEquals(200, ok.getStatus());
        assertEquals("42", ok.getEntity());
        assertEquals(403, resource.verify("other", "subscribe", TOKEN, "42").getStatus());
    }

    @Test
    void aDeliveryMustBeSignedWithTheConnectionsAppSecret() throws Exception {
        assertEquals(200, resource.receive(CONNECTION, sign(SECRET), DELIVERY).await().indefinitely().getStatus());
        assertEquals(List.of("org-a"), enqueuedFor);

        assertEquals(401, resource.receive(CONNECTION, sign("another"), DELIVERY).await().indefinitely()
                .getStatus());
        assertEquals(401, resource.receive("other", sign(SECRET), DELIVERY).await().indefinitely().getStatus());
        assertEquals(1, enqueuedFor.size());
    }

    private static String sign(String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(DELIVERY));
    }
}
