package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The detector's profile write sent with the frame and waited for when the caller settles it. */
class FrameSentTest {

    private static final Instant T0 = Instant.parse("2026-11-07T12:00:00Z");
    private static final Map<String, Object> SIGNAL = Map.of("sender", "S1",
            "frame", Map.of("gps", Map.of("speed", 80.0), "sensors", Map.of("engine_status", true)));

    private final TestClock clock = new TestClock(T0);
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final List<Runnable> pending = new ArrayList<>();
    private boolean failWrite;
    private final InMemoryLossStore store = new InMemoryLossStore(clock) {
        @Override
        public Runnable send(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile,
                Schedule schedule, Mark mark, Reporting reporting) {
            Runnable write = () -> {
                if (failWrite) {
                    throw new IllegalStateException("redis down");
                }
                save(assetId, vehicle, sender, senderProfile, schedule, mark, reporting);
            };
            pending.add(write);
            return write;
        }
    };
    private final LostSignalDetector detector = new LostSignalDetector(true, store, LossSettings.defaults(),
            LostSignalDetector.TickerSettings.defaults(), new TestEngine(clock).trips(meters), meters, clock);

    @Test
    void theWriteLandsWhenSettled() {
        LostSignalDetector.Sent sent = detector.frameSent("V1", T0, T0.plusSeconds(2), SIGNAL);

        assertEquals(1, pending.size());
        assertNull(store.load("V1", "S1").vehicle(), "not written before it is settled");
        sent.settle();
        assertNotNull(store.load("V1", "S1").vehicle());
    }

    @Test
    void aFailedWriteIsCountedOnSettleAndNotThrown() {
        failWrite = true;

        detector.frameSent("V1", T0, T0.plusSeconds(2), SIGNAL).settle();

        assertEquals(1.0, meters.counter("miot.symptoms.lost_signal.failed").count());
        detector.frameSent("V1", T0.plusSeconds(30), T0.plusSeconds(32), SIGNAL).settle();
        assertEquals(1.0, meters.counter("miot.symptoms.lost_signal.skipped").count(), "backs off as before");
    }
}
