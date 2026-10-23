package com.microboxlabs.miot.symptoms.catalog.cel;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RuleMessageTest {

    @Test
    void aMessageWithoutCodeIsEmpty() {
        RuleMessage message = new RuleMessage(null, null);
        assertEquals("", message.spanish());
        assertEquals(Map.of(), message.params());
    }

    @Test
    void nullParamsAreDropped() {
        Map<String, String> params = new HashMap<>();
        params.put("term", null);
        params.put(null, "x");
        params.put("field", "speed");
        assertEquals(Map.of("field", "speed"), new RuleMessage("sourceMissing", params).params());
    }
}
