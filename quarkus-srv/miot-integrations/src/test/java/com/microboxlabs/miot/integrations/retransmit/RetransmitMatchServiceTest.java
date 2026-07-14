package com.microboxlabs.miot.integrations.retransmit;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.util.List;
import org.junit.jupiter.api.Test;

class RetransmitMatchServiceTest {

    @Test
    void extractPayloads_singleObject() {
        JsonObject data = new JsonObject().put("config_id", "mel-gauss").put("asset_id", "ABC12");
        List<JsonObject> payloads = RetransmitMatchService.extractPayloads(data);
        assertEquals(1, payloads.size());
        assertEquals("mel-gauss", payloads.get(0).getString("config_id"));
    }

    @Test
    void extractPayloads_array() {
        JsonArray arr = new JsonArray()
                .add(new JsonObject().put("config_id", "a"))
                .add(new JsonObject().put("config_id", "b"));
        List<JsonObject> payloads = RetransmitMatchService.extractPayloads(arr);
        assertEquals(2, payloads.size());
        assertEquals("a", payloads.get(0).getString("config_id"));
        assertEquals("b", payloads.get(1).getString("config_id"));
    }

    @Test
    void buildDedupeKey_prefersAssetDataId() {
        JsonObject payload = new JsonObject()
                .put("config_id", "mel-gauss")
                .put("asset_id", "GZKD49")
                .put("asset_data_id", 10113343)
                .put("request_id", "req-1")
                .put("mode", "full");
        assertEquals("mel-gauss:GZKD49:10113343:full", RetransmitMatchService.buildDedupeKey(payload));
    }

    @Test
    void buildDedupeKey_fallsBackToRequestId() {
        JsonObject payload = new JsonObject()
                .put("config_id", "mel-gauss")
                .put("asset_id", "GZKD49")
                .put("request_id", "req-1")
                .put("mode", "privacy");
        assertEquals("mel-gauss:GZKD49:req-1:privacy", RetransmitMatchService.buildDedupeKey(payload));
    }
}
