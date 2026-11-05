package com.microboxlabs.miot.symptoms.cases;

import com.microboxlabs.miot.symptoms.catalog.service.SymptomStateChanged;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.runtime.StartupEvent;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.time.Duration;
import org.jboss.logging.Logger;

/**
 * Closes the cases left open in a state their symptom no longer has ({@link EngineCaseService#closeStaleCases}):
 * the symptom's cases right after it changes state, and every organization's at startup, which also cleans the
 * cases a state change left open before this ran. Each run takes a database lock, so replicas run one at a time
 * and the second finds nothing to close.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class StaleCaseSweep {

    private static final Logger LOG = Logger.getLogger(StaleCaseSweep.class);
    private static final int STARTUP_ATTEMPTS = 5;

    private final EngineCaseService cases;

    @Inject
    public StaleCaseSweep(EngineCaseService cases) {
        this.cases = cases;
    }

    /** Off the startup thread, retried while the database is not ready. */
    void onStart(@Observes StartupEvent ignored) {
        Uni.createFrom().item(() -> cases.closeStaleCases(null, null))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .onFailure().retry().withBackOff(Duration.ofSeconds(2), Duration.ofMinutes(1))
                .atMost(STARTUP_ATTEMPTS)
                .subscribe().with(
                        n -> LOG.infof("Engine cases: closed %d left open in an earlier state", n),
                        e -> LOG.warnf("Engine cases: startup cleanup failed (%s)", e.getClass().getSimpleName()));
    }

    /**
     * Runs where the change was saved. A failure leaves the cases to the evaluator and the next startup; the state
     * change stands.
     */
    void onStateChanged(@Observes SymptomStateChanged change) {
        try {
            int n = cases.closeStaleCases(change.tenantCode(), change.definitionId());
            LOG.debugf("Symptom %s: %s to %s closed %d cases", change.definitionId(), change.from(), change.to(), n);
        } catch (RuntimeException e) {
            LOG.warnf("Symptom %s: cases of the earlier state not closed (%s)", change.definitionId(),
                    e.getClass().getSimpleName());
        }
    }
}
