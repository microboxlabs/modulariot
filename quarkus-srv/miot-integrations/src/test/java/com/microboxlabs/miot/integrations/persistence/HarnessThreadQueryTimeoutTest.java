package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.lang.reflect.Field;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The query window is what stops a dead pooled connection parking a caller for
 * good, so a misconfigured value must not quietly switch that protection off.
 */
class HarnessThreadQueryTimeoutTest {

    @Test
    @DisplayName("honours a configured window")
    void honoursConfiguredWindow() {
        assertEquals(Duration.ofSeconds(3), timeoutOf(Duration.ofSeconds(3)));
    }

    @Test
    @DisplayName("zero would await forever, so it falls back to the default")
    void zeroFallsBack() {
        assertEquals(Duration.ofSeconds(10), timeoutOf(Duration.ZERO));
    }

    @Test
    @DisplayName("a negative window falls back to the default")
    void negativeFallsBack() {
        assertEquals(Duration.ofSeconds(10), timeoutOf(Duration.ofSeconds(-1)));
    }

    private static Duration timeoutOf(Duration configured) {
        HarnessThreadRepository repository = new HarnessThreadRepository(null, configured);
        try {
            Field field = HarnessThreadRepository.class.getDeclaredField("queryTimeout");
            field.setAccessible(true);
            return (Duration) field.get(repository);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("queryTimeout is no longer readable", e);
        }
    }
}
