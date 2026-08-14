package com.microboxlabs.miot.symptoms.process;

import io.smallrye.mutiny.Uni;
import java.time.Duration;
import java.util.concurrent.Semaphore;

/**
 * Per-route async permit. Does not block the Vert.x event loop:
 * {@link Semaphore#tryAcquire()} only, then the work Uni runs as-is.
 * Timeout nacks the Pulsar message; it does not cancel an in-flight
 * {@code SELECT process_symptoms_*}.
 */
public final class RouteBulkhead {

    private final String name;
    private final Semaphore permits;
    private final Duration timeout;

    public RouteBulkhead(String name, int concurrency, Duration timeout) {
        this.name = name;
        this.permits = new Semaphore(concurrency);
        this.timeout = timeout;
    }

    public <T> Uni<T> execute(Uni<T> work) {
        if (!permits.tryAcquire()) {
            return Uni.createFrom()
                    .failure(new BulkheadSaturatedException("bulkhead saturated: " + name));
        }
        return work.ifNoItem()
                .after(timeout)
                .fail()
                .onTermination()
                .invoke(permits::release);
    }

    public static final class BulkheadSaturatedException extends RuntimeException {
        public BulkheadSaturatedException(String message) {
            super(message);
        }
    }
}
