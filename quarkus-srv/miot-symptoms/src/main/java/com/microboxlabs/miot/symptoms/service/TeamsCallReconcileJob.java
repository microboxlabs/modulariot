package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.symptoms.store.ContactSyncStore;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import com.microboxlabs.miot.symptoms.store.TreatmentStore.Caller;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Reconciles pending Teams calls on the server, so a call gets its result even when its operator never saves
 * another one. Each run reads who has pending Teams calls, then runs {@link TeamsCallReconciler} for every one of
 * those operators in each organization with a ready TEAMS_PHONE line. A record still goes only to the operator
 * who placed the call. A run with nothing pending ends after that one query. One replica runs it at a time
 * (Postgres advisory lock), and a run never overlaps the previous one.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TeamsCallReconcileJob {

    private static final Logger LOG = Logger.getLogger(TeamsCallReconcileJob.class);
    static final String LOCK = "miot_symptoms.teams_reconcile";
    static final int MAX_CALLERS = 500;

    /** What one run did. {@code failed}: operators whose reconcile threw. */
    public record Run(int organizations, int operators, int recorded, int failed) {
        static final Run NOTHING = new Run(0, 0, 0, 0);
    }

    private final boolean enabled;
    private final TreatmentStore treatments;
    private final Telephony telephony;
    private final TeamsCallReconciler reconciler;
    private final Function<Supplier<Run>, Optional<Run>> exclusively;
    private final Clock clock;

    @Inject
    TeamsCallReconcileJob(
            @ConfigProperty(name = "miot.symptoms.teams-reconcile.enabled", defaultValue = "true") boolean enabled,
            TreatmentStore treatments, Telephony telephony, TeamsCallReconciler reconciler, ContactSyncStore locks) {
        this(enabled, treatments, telephony, reconciler, work -> locks.exclusively(LOCK, work), Clock.systemUTC());
    }

    TeamsCallReconcileJob(boolean enabled, TreatmentStore treatments, Telephony telephony,
            TeamsCallReconciler reconciler, Function<Supplier<Run>, Optional<Run>> exclusively, Clock clock) {
        this.enabled = enabled;
        this.treatments = treatments;
        this.telephony = telephony;
        this.reconciler = reconciler;
        this.exclusively = exclusively;
        this.clock = clock;
    }

    @Scheduled(every = "${miot.symptoms.teams-reconcile.every:5m}", delayed = "2m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduled() {
        if (!enabled) {
            return;
        }
        try {
            Run run = run();
            if (run.operators() > 0) {
                LOG.infof("Teams call reconcile: %d organizations, %d operators, %d recorded, %d failed",
                        run.organizations(), run.operators(), run.recorded(), run.failed());
            }
        } catch (RuntimeException e) {
            LOG.warnf("Teams call reconcile failed: %s", e.getMessage());
        }
    }

    Run run() {
        OffsetDateTime since = OffsetDateTime.now(clock).minus(TeamsCallReconciler.LOOKBACK);
        List<Caller> callers = treatments.pendingTeamsCallers(since, MAX_CALLERS);
        if (callers.isEmpty()) {
            return Run.NOTHING;
        }
        Optional<Run> run = exclusively.apply(() -> reconcile(callers));
        if (run.isEmpty()) {
            LOG.debug("Teams call reconcile skipped: another replica is running it");
        }
        return run.orElse(Run.NOTHING);
    }

    private Run reconcile(List<Caller> callers) {
        Map<String, List<String>> byOrganization = new LinkedHashMap<>();
        callers.forEach(c -> byOrganization.computeIfAbsent(c.tenantCode(), k -> new ArrayList<>())
                .add(c.performedBy()));
        int organizations = 0;
        int operators = 0;
        int recorded = 0;
        int failed = 0;
        for (Map.Entry<String, List<String>> organization : byOrganization.entrySet()) {
            String tenant = organization.getKey();
            if (!hasReadyTeamsLine(tenant)) {
                continue;
            }
            organizations++;
            for (String operator : organization.getValue()) {
                operators++;
                try {
                    recorded += reconciler.reconcile(tenant, operator).recorded();
                } catch (RuntimeException e) {
                    failed++;
                    LOG.warnf("Teams call reconcile failed for an operator of %s: %s", tenant, e.getMessage());
                }
            }
        }
        return new Run(organizations, operators, recorded, failed);
    }

    private boolean hasReadyTeamsLine(String tenant) {
        try {
            return telephony.lines(tenant).stream()
                    .anyMatch(l -> l.provider() == TelephonyProvider.TEAMS_PHONE && l.ready());
        } catch (RuntimeException e) {
            LOG.warnf("Teams call reconcile could not read the lines of %s: %s", tenant, e.getMessage());
            return false;
        }
    }
}
