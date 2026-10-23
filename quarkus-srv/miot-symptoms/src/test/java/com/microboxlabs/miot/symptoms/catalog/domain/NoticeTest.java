package com.microboxlabs.miot.symptoms.catalog.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class NoticeTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void aStoredNoticeKeepsItsChannelAndDropsItsConnection() throws Exception {
        SymptomSpec.Notice notice = json.readValue("""
                {"when":"open","channel":"email","connectionId":"c1","templateId":"t1","recipient":"torre"}""",
                SymptomSpec.Notice.class);

        assertEquals(new SymptomSpec.Notice("open", "email", null, "torre"), notice);
        String written = json.writeValueAsString(notice);
        assertFalse(written.contains("connectionId"), written);
    }
}
