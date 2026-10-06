package com.microboxlabs.miot.integrations.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.junit.jupiter.api.Test;

class ResendClientTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ResendClient client = new ResendClient(mapper);
    private final EmailMessage message =
            new EmailMessage("Team <no-reply@example.test>", "ana@example.test", "Hi", "Plain", "<p>Hi</p>", null);

    @Test
    void sendsOneEmailWithTheKeyAndTheIdempotencyKey() throws IOException {
        try (FakeResend resend = new FakeResend().reply("/emails", 200, "{\"id\":\"email-1\"}")) {
            SendResult result = client.send(resend.baseUrl(), "re_test", message, "invite-1:abc");

            assertTrue(result.accepted());
            assertEquals("email-1", result.messageId());
            FakeResend.Seen seen = resend.last();
            assertEquals("POST", seen.method());
            assertEquals("Bearer re_test", seen.headers().get("authorization"));
            assertEquals("invite-1:abc", seen.headers().get("idempotency-key"));
            JsonNode body = mapper.readTree(seen.body());
            assertEquals("ana@example.test", body.path("to").get(0).asText());
            assertEquals("Team <no-reply@example.test>", body.path("from").asText());
            assertEquals("Plain", body.path("text").asText());
            assertEquals("<p>Hi</p>", body.path("html").asText());
            assertTrue(body.path("reply_to").isMissingNode());
        }
    }

    @Test
    void aRejectedEmailCarriesResendsMessage() throws IOException {
        try (FakeResend resend = new FakeResend().reply("/emails", 422,
                "{\"statusCode\":422,\"name\":\"validation_error\",\"message\":\"The from domain is not verified\"}")) {
            SendResult result = client.send(resend.baseUrl(), "re_test", message, null);

            assertFalse(result.accepted());
            assertEquals(422, result.status());
            assertNull(result.messageId());
            assertEquals("Resend returned HTTP 422: The from domain is not verified", result.error());
            assertNull(resend.last().headers().get("idempotency-key"));
        }
    }
}
