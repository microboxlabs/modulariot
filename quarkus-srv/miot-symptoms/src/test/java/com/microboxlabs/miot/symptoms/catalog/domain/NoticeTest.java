package com.microboxlabs.miot.symptoms.catalog.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class NoticeTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void aStoredChannelReadsAsTheConnectionKind() throws Exception {
        SymptomSpec.Notice notice = json.readValue(
                "{\"when\":\"open\",\"channel\":\"email\",\"connectionId\":\"c1\",\"recipient\":\"torre\"}",
                SymptomSpec.Notice.class);

        assertEquals(new SymptomSpec.Notice("open", "RESEND", "c1", null, "torre"), notice);
        assertNull(json.readValue("{\"when\":\"open\",\"channel\":\"app\"}", SymptomSpec.Notice.class).kind());
    }

    @Test
    void aKindWinsOverAStoredChannelAndIsWhatIsWritten() throws Exception {
        SymptomSpec.Notice notice = json.readValue(
                "{\"when\":\"open\",\"kind\":\"N8N\",\"channel\":\"whatsapp\"}", SymptomSpec.Notice.class);

        assertEquals("N8N", notice.kind());
        String written = json.writeValueAsString(notice);
        assertFalse(written.contains("channel"), written);
    }
}
