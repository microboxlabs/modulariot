package com.microboxlabs.miot.integrations.jobs;

import com.microboxlabs.miot.integrations.persistence.HarnessThreadRepository;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Collects chat threads that have outlived their retention: the ones whose
 * {@code expires_at} has passed, and the ones a user deleted once the grace
 * window is over. Messages and shares follow through ON DELETE CASCADE.
 *
 * <p>Threads have no expiry unless someone sets one, so on a normal deployment
 * this pass deletes only what users deleted themselves.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class HarnessThreadPurgeJob {

    private static final Logger LOG = Logger.getLogger(HarnessThreadPurgeJob.class);

    private final HarnessThreadRepository repository;
    private final boolean enabled;
    private final int graceDays;

    @Inject
    public HarnessThreadPurgeJob(
            HarnessThreadRepository repository,
            @ConfigProperty(name = "miot.harness-threads.purge.enabled", defaultValue = "true")
            boolean enabled,
            @ConfigProperty(name = "miot.harness-threads.purge.grace-days", defaultValue = "30")
            int graceDays) {
        this.repository = repository;
        this.enabled = enabled;
        // A negative grace window would put the cutoff in the future, and the
        // next pass would delete every thread anyone had just deleted instead
        // of holding them.
        if (graceDays < 0) {
            LOG.warnf("Ignoring negative purge grace window (%d days); using 0", graceDays);
        }
        this.graceDays = Math.max(0, graceDays);
    }

    @Scheduled(
            cron = "{miot.harness-threads.purge.cron}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void purge() {
        if (!enabled) {
            return;
        }
        try {
            int removed = repository.purge(OffsetDateTime.now(ZoneOffset.UTC).minusDays(graceDays));
            if (removed > 0) {
                LOG.infof("Purged %d harness chat thread(s)", removed);
            }
        } catch (RuntimeException e) {
            // A failed pass is not worth failing the scheduler over: the rows
            // are still there and the next run picks them up.
            LOG.warn("Harness chat thread purge failed", e);
        }
    }
}
