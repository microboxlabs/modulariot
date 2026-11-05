package com.microboxlabs.miot.symptoms.cases;

import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Ends the "Ignorar condición" holds that are due ({@link HoldService#endDue}). Several pods may run it: a hold's
 * treatment closes once, and only that pod records the end. On unless {@code miot.symptoms.holds.enabled} is false.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class HoldTimer {

    private static final Logger LOG = Logger.getLogger(HoldTimer.class);
    static final int BATCH = 500;

    private final boolean enabled;
    private final HoldService holds;

    @Inject
    HoldTimer(@ConfigProperty(name = "miot.symptoms.holds.enabled", defaultValue = "true") boolean enabled,
            HoldService holds) {
        this.enabled = enabled;
        this.holds = holds;
    }

    @Scheduled(every = "${miot.symptoms.holds.every:30s}", delayed = "30s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void tick() {
        if (!enabled) {
            return;
        }
        try {
            int ended = holds.endDue(BATCH);
            if (ended > 0) {
                LOG.debugf("Ignore holds ended: %d", ended);
            }
        } catch (RuntimeException e) {
            // The holds stay due: the next run finds them again.
            LOG.warnf("Ignore hold timer: run failed (%s)", e.getClass().getSimpleName());
        }
    }
}
