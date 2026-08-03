package com.microboxlabs.miot.integrations.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobState;
import io.vertx.core.json.JsonObject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class JobEventEmitterTest {

    @Test
    void unconfiguredEmitterIsDisabledAndEmitIsANoOp() {
        var emitter = new JobEventEmitter(Optional.empty());
        assertFalse(emitter.isConfigured());
        emitter.emit(job(), "enqueued"); // must not throw or attempt I/O
        emitter.emit(null, "enqueued");
    }

    @Test
    void blankUrlCountsAsUnconfigured() {
        assertFalse(new JobEventEmitter(Optional.of("   ")).isConfigured());
        assertTrue(new JobEventEmitter(Optional.of("http://quarkus-sse:8080/")).isConfigured());
    }

    @Test
    void eventDataMatchesTheQuarkusSseContract() {
        var emitter = new JobEventEmitter(Optional.of("http://quarkus-sse:8080"));

        JsonObject frame = emitter.eventData(job(), "retry_scheduled");

        assertEquals("integrations.job", frame.getString("eventType"));
        assertEquals("tenant-code-1", frame.getString("tenantId"));
        assertNotNull(frame.getString("timestamp"));

        JsonObject payload = frame.getJsonObject("payload");
        assertEquals("job-1", payload.getString("jobId"));
        assertEquals("calendar_sync", payload.getString("jobType"));
        assertEquals("PENDING", payload.getString("state"));
        assertEquals("retry_scheduled", payload.getString("transition"));
        assertEquals(2, payload.getInteger("attempts"));
        assertEquals(5, payload.getInteger("maxAttempts"));
        assertEquals("VJ-26-0001", payload.getString("correlationKey"));
        assertEquals("chain-1", payload.getString("chainKey"));
        assertEquals("409 conflict", payload.getString("lastError"));
        assertNull(payload.getString("updatedAt"));
        assertNull(payload.getString("jobOp"), "a payload with no op emits none");
    }

    @Test
    void eventDataLiftsThePayloadOpOntoTheFrame() {
        var emitter = new JobEventEmitter(Optional.of("http://quarkus-sse:8080"));

        assertEquals("unassign",
                emitter.eventData(job(Map.of("op", "unassign")), "enqueued")
                        .getJsonObject("payload").getString("jobOp"));
        // Blank / non-string ops are not ops.
        assertNull(emitter.eventData(job(Map.of("op", "  ")), "enqueued")
                .getJsonObject("payload").getString("jobOp"));
        assertNull(emitter.eventData(job(Map.of("op", 42)), "enqueued")
                .getJsonObject("payload").getString("jobOp"));
    }

    private static AsyncJob job() {
        return job(Map.of());
    }

    private static AsyncJob job(Map<String, Object> payload) {
        return new AsyncJob("job-1", "tenant-code-1", "ecm-1", "modulith", "calendar_sync", "VJ-26-0001",
                "chain-1", 0, "dk-1", payload, JobState.PENDING, 2, 5,
                OffsetDateTime.now(ZoneOffset.UTC), null, null, "409 conflict", List.of(), "listener",
                null, null, null);
    }
}
