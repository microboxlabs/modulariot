package com.microboxlabs.miot.core.content;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/** Deletes content no record took within the grace period, such as an upload whose record failed to save. */
@ApplicationScoped
public class ContentCleanup {

    private static final Logger LOG = Logger.getLogger(ContentCleanup.class);
    private static final int BATCH = 200;

    private final ContentService contents;
    private final boolean enabled;

    @Inject
    ContentCleanup(ContentService contents,
            @ConfigProperty(name = "miot.content.cleanup.enabled", defaultValue = "true") boolean enabled) {
        this.contents = contents;
        this.enabled = enabled;
    }

    @Scheduled(every = "${miot.content.cleanup.every:1h}", delayed = "5m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void run() {
        if (!enabled) {
            return;
        }
        try {
            int n = contents.deleteUnowned(BATCH);
            if (n > 0) {
                LOG.infof("Deleted %d unowned contents", n);
            }
        } catch (RuntimeException e) {
            LOG.warnf("Content cleanup failed: %s", e.getMessage());
        }
    }
}
