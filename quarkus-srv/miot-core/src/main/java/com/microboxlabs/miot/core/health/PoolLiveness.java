package com.microboxlabs.miot.core.health;

import com.microboxlabs.miot.core.db.PgTx;
import io.quarkus.scheduler.Scheduled;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Liveness;
import org.jboss.logging.Logger;

/**
 * Down when the main reactive pool has not handed out a connection for {@code down-after} and at least
 * {@code failures} probes in a row failed, so Kubernetes restarts a pod whose pool is stuck instead of leaving it
 * unready. The probe runs on the scheduler; {@link #call()} only reads its result, so the liveness request never
 * waits for the pool. One slow acquire does not turn it down: any successful probe resets it.
 */
@Liveness
@ApplicationScoped
public class PoolLiveness implements HealthCheck {

    private static final Logger LOG = Logger.getLogger(PoolLiveness.class);
    private static final Duration ACQUIRE_TIMEOUT = Duration.ofSeconds(5);

    private record Failing(int probes, Instant since) {
    }

    private final Supplier<Pool> pool;
    private final Clock clock;
    private final Duration acquireTimeout;
    private final Duration downAfter;
    private final int failures;
    private final AtomicReference<Failing> failing = new AtomicReference<>();

    @Inject
    PoolLiveness(Instance<Pool> pool,
            @ConfigProperty(name = "miot.db.liveness.down-after", defaultValue = "60s") Duration downAfter,
            @ConfigProperty(name = "miot.db.liveness.failures", defaultValue = "3") int failures) {
        this(() -> pool.isResolvable() ? pool.get() : null, Clock.systemUTC(), ACQUIRE_TIMEOUT, downAfter, failures);
    }

    PoolLiveness(Supplier<Pool> pool, Clock clock, Duration acquireTimeout, Duration downAfter, int failures) {
        this.pool = pool;
        this.clock = clock;
        this.acquireTimeout = acquireTimeout;
        this.downAfter = downAfter;
        this.failures = failures;
    }

    @Scheduled(every = "${miot.db.liveness.every:10s}", delayed = "10s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void probe() {
        Pool current = pool.get();
        if (current == null) {
            return;
        }
        try {
            PgTx.acquire(current, acquireTimeout).close().await().atMost(acquireTimeout);
            if (failing.getAndSet(null) != null) {
                LOG.info("The database pool hands out connections again");
            }
        } catch (RuntimeException e) {
            Failing now = failing.updateAndGet(f -> f == null ? new Failing(1, clock.instant())
                    : new Failing(f.probes() + 1, f.since()));
            LOG.warnf("The database pool gave no connection in %s (%d in a row since %s): %s", acquireTimeout,
                    now.probes(), now.since(), e.toString());
        }
    }

    @Override
    public HealthCheckResponse call() {
        Failing f = failing.get();
        var builder = HealthCheckResponse.named("database-pool");
        if (f == null) {
            return builder.up().build();
        }
        boolean down = f.probes() >= failures && !clock.instant().isBefore(f.since().plus(downAfter));
        return builder.status(!down)
                .withData("failedProbes", f.probes())
                .withData("failingSince", f.since().toString())
                .build();
    }
}
