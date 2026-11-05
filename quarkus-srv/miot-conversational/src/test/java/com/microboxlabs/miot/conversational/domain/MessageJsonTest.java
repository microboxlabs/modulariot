package com.microboxlabs.miot.conversational.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** API clients read the provider id as {@code metaMessageId}; the field must stay in the JSON. */
class MessageJsonTest {

    @Test
    void serializesTheProviderIdUnderBothNames() throws Exception {
        Message message = new Message("m-1", "c-1", MessageDirection.OUTBOUND, MessageRole.AGENT,
                MessageType.TEXT, "hola", null, null, null, null, "wamid.1", MessageStatus.SENT, null,
                "user-1", "SVC-1", null, Map.of(), null, null, null, null,
                Channel.WHATSAPP, "+56900000001", null, null, null);

        JsonNode json = new ObjectMapper().findAndRegisterModules().valueToTree(message);

        assertEquals("wamid.1", json.get("metaMessageId").asText());
        assertEquals("wamid.1", json.get("providerMessageId").asText());
        assertEquals("WHATSAPP", json.get("channel").asText());
        assertEquals("+56900000001", json.get("address").asText());
    }
}
