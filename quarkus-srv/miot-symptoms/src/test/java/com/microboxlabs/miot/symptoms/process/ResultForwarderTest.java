package com.microboxlabs.miot.symptoms.process;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.core.json.JsonObject;
import java.net.http.HttpClient;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class ResultForwarderTest {

    private final ResultForwarder forwarder = new ResultForwarder(HttpClient.newHttpClient(), Duration.ofSeconds(1));

    @Test
    void legacyEnvelopeWithoutForwardStillForwards() {
        assertTrue(forwarder.shouldForward(
                new JsonObject().put("status", 200).put("message", "ok").put("data", new JsonObject())));
    }

    @Test
    void forwardFalseSkips() {
        assertFalse(forwarder.shouldForward(new JsonObject().put("status", 204).put("forward", false)));
    }

    @Test
    void status204AloneSkips() {
        assertFalse(forwarder.shouldForward(new JsonObject().put("status", 204)));
    }

    @Test
    void nullResultSkips() {
        assertFalse(forwarder.shouldForward(null));
    }
}
