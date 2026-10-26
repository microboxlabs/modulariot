package com.microboxlabs.miot.integrations.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.smallrye.mutiny.helpers.test.AssertSubscriber;
import io.vertx.core.json.JsonObject;
import jakarta.ws.rs.ServiceUnavailableException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class JobEventBusTest {

    private static JsonObject frame(String tenant, String jobId, String error) {
        return new JsonObject().put("eventType", JobEventEmitter.EVENT_TYPE).put("tenantId", tenant)
                .put("payload", new JsonObject().put("jobId", jobId).put("transition", "failed")
                        .put("lastError", error));
    }

    @Test
    void aNotificationReachesOnlyTheBrowsersOfItsTenant() {
        JobEventBus bus = new JobEventBus(() -> null, null, true);
        AssertSubscriber<JsonObject> mine = bus.stream("tenant-a").subscribe()
                .withSubscriber(AssertSubscriber.create(10));
        AssertSubscriber<JsonObject> other = bus.stream("tenant-b").subscribe()
                .withSubscriber(AssertSubscriber.create(10));

        bus.dispatch(frame("tenant-a", "job-1", null).encode());
        bus.dispatch("not json");

        assertEquals(List.of("job-1"), jobIds(mine));
        assertEquals(List.of(), jobIds(other));
    }

    private static List<String> jobIds(AssertSubscriber<JsonObject> subscriber) {
        return subscriber.getItems().stream().filter(f -> !"ping".equals(f.getString("eventType")))
                .map(f -> f.getJsonObject("payload").getString("jobId")).toList();
    }

    @Test
    void aFrameTooLongForANotificationGoesWithoutItsError() {
        String small = JobEventBus.fit(frame("tenant-a", "job-1", "short"));
        assertEquals("short", new JsonObject(small).getJsonObject("payload").getString("lastError"));

        String big = JobEventBus.fit(frame("tenant-a", "job-2", "x".repeat(JobEventBus.MAX_FRAME)));
        JsonObject payload = new JsonObject(big).getJsonObject("payload");
        assertNull(payload.getString("lastError"));
        assertEquals("job-2", payload.getString("jobId"));
        assertTrue(big.length() <= JobEventBus.MAX_FRAME);
    }

    @Test
    void aDisabledBusHasNoStream() {
        JobEventBus bus = new JobEventBus(() -> null, null, false);
        assertThrows(ServiceUnavailableException.class, () -> bus.stream("tenant-a"));
    }

    @Test
    void theEmitterPublishesEachTransitionToTheBus() {
        List<JsonObject> published = new ArrayList<>();
        JobEventBus bus = new JobEventBus(() -> null, null, true) {
            @Override
            public void publish(JsonObject frame) {
                published.add(frame);
            }
        };
        JobEventEmitter emitter = new JobEventEmitter(Optional.empty(), bus);

        assertTrue(emitter.isLive());
        emitter.emit(JobEventEmitterTest.job(), "claimed");

        assertEquals(1, published.size());
        assertEquals("claimed", published.get(0).getJsonObject("payload").getString("transition"));
        assertTrue(!new JobEventEmitter(Optional.empty()).isLive(), "without a bus the console is not live");
    }
}
