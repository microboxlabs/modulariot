package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.smallrye.mutiny.TimeoutException;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import java.lang.reflect.Field;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

/**
 * The query window is what stops a dead pooled connection parking a caller for
 * good, so a misconfigured value must not quietly switch that protection off.
 */
class HarnessThreadQueryTimeoutTest {

    /**
     * The regression this bound exists for: a connection that dies without the
     * server closing it cleanly leaves a query that never answers. Reverting to
     * {@code await().indefinitely()} does not fail this assertion — it hangs, so
     * the timeout below is what reports it.
     */
    @Test
    @Timeout(10)
    @DisplayName("gives up on a query that never answers")
    void givesUpOnAQueryThatNeverAnswers() {
        HarnessThreadRepository repository =
                new HarnessThreadRepository(null, Duration.ofMillis(200));
        Uni<RowSet<Row>> neverAnswers = Uni.createFrom().nothing();

        long startedAt = System.nanoTime();
        assertThrows(TimeoutException.class, () -> repository.awaitRows(neverAnswers));

        long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
        // Generous: the point is that it returned at all, not how promptly.
        assertTrue(
                elapsedMs < 5_000, "waited " + elapsedMs + "ms, so the bound did not apply");
    }

    @Test
    @DisplayName("a query that answers is passed straight through")
    void passesThroughAnAnswer() {
        HarnessThreadRepository repository =
                new HarnessThreadRepository(null, Duration.ofSeconds(5));

        assertNull(
                repository.awaitRows(Uni.createFrom().nullItem()));
    }

    @Test
    @DisplayName("honours a configured window")
    void honoursConfiguredWindow() {
        assertEquals(Duration.ofSeconds(3), timeoutOf(Duration.ofSeconds(3)));
    }

    // Mutiny rejects a non-positive atMost outright, so an unclamped zero would
    // fail every query rather than widen the window.
    @Test
    @DisplayName("falls back when the configured window is zero")
    void zeroFallsBack() {
        assertEquals(Duration.ofSeconds(10), timeoutOf(Duration.ZERO));
    }

    @Test
    @DisplayName("falls back when the configured window is negative")
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
