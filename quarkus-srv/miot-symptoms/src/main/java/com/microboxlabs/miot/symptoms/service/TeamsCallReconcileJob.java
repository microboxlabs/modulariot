package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyThrottledException;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Reconciles pending Teams calls on the server, so a call gets its result even when its operator never saves
 * another one. Each run reads who has pending Teams calls, then runs {@link TeamsCallReconciler} for those
 * operators in each organization with a ready TEAMS_PHONE line. A record still goes only to the operator who
 * placed the call. A run makes at most {@code max-lookups} organization lookups, each one complete Graph read.
 * The next run starts after the last organization this one reached, so every organization is reached over
 * several runs. An organization Graph throttled is skipped until its {@code Retry-After} has passed. The shared
 * checkpoint survives restarts and changes of replica. A run with nothing pending ends without contacting Graph.
 * One replica runs it at a time (Postgres advisory lock), and a run never overlaps the previous one.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TeamsCallReconcileJob {

    private static final Logger LOG = Logger.getLogger(TeamsCallReconcileJob.class);
    static final String LOCK = "miot_symptoms.teams_reconcile";
    static final int MAX_CALLERS = 500;
    static final int DEFAULT_MAX_LOOKUPS = 50;

    /**
     * What one run did. {@code failed}: operators whose reconcile threw. {@code throttled}: organizations skipped
     * or stopped because Graph throttled them.
     */
    public record Run(int organizations, int operators, int recorded, int failed, int throttled) {
        static final Run NOTHING = new Run(0, 0, 0, 0, 0);

        Run(int organizations, int operators, int recorded, int failed) {
            this(organizations, operators, recorded, failed, 0);
        }
    }

    private final boolean enabled;
    private final int maxLookups;
    private final TreatmentStore treatments;
    private final Telephony telephony;
    private final TeamsCallReconciler reconciler;
    private final Function<Supplier<Run>, Optional<Run>> exclusively;
    private final Clock clock;

    @Inject
    TeamsCallReconcileJob(
            @ConfigProperty(name = "miot.symptoms.teams-reconcile.enabled", defaultValue = "true") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.teams-reconcile.max-lookups", defaultValue = "50") int maxLookups,
            TreatmentStore treatments, Telephony telephony, TeamsCallReconciler reconciler, ContactSyncStore locks) {
        this(enabled, maxLookups, treatments, telephony, reconciler, work -> locks.exclusively(LOCK, work),
                Clock.systemUTC());
    }

    TeamsCallReconcileJob(boolean enabled, int maxLookups, TreatmentStore treatments, Telephony telephony,
            TeamsCallReconciler reconciler, Function<Supplier<Run>, Optional<Run>> exclusively, Clock clock) {
        if (maxLookups < 1) {
            throw new IllegalArgumentException("miot.symptoms.teams-reconcile.max-lookups must be at least 1");
        }
        this.enabled = enabled;
        this.maxLookups = maxLookups;
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
            if (run.operators() > 0 || run.throttled() > 0) {
                LOG.infof("Teams call reconcile: %d organizations, %d operators, %d recorded, %d failed,"
                        + " %d throttled", run.organizations(), run.operators(), run.recorded(), run.failed(),
                        run.throttled());
            }
        } catch (RuntimeException e) {
            LOG.warnf("Teams call reconcile failed: %s", e.getMessage());
        }
    }

    Run run() {
        Optional<Run> run = exclusively.apply(() -> {
            OffsetDateTime since = OffsetDateTime.now(clock).minus(TeamsCallReconciler.LOOKBACK);
            List<Caller> callers = treatments.pendingTeamsCallers(since, MAX_CALLERS,
                    treatments.teamsReconcileCursor().orElse(null));
            return reconcile(callers);
        });
        if (run.isEmpty()) {
            LOG.debug("Teams call reconcile skipped: another replica is running it");
        }
        return run.orElse(Run.NOTHING);
    }

    /** Checkpoint in selection order, but share one lookup even when a wrapped organization has two blocks. */
    private Run reconcile(List<Caller> callers) {
        int organizations = 0;
        int operators = 0;
        int recorded = 0;
        int failed = 0;
        int throttled = 0;
        Map<String, List<Caller>> callersByOrganization = callers.stream()
                .collect(Collectors.groupingBy(Caller::tenantCode));
        Set<String> visited = new HashSet<>();
        for (List<Caller> organization : byOrganization(callers)) {
            if (organizations == maxLookups) {
                break;
            }
            String tenant = organization.getFirst().tenantCode();
            treatments.saveTeamsReconcileCursor(organization.getLast());
            if (visited.add(tenant)) {
                Run result = reconcileOrganization(tenant, callersByOrganization.get(tenant));
                organizations += result.organizations();
                operators += result.operators();
                recorded += result.recorded();
                failed += result.failed();
                throttled += result.throttled();
            }
        }
        return new Run(organizations, operators, recorded, failed, throttled);
    }

    private Run reconcileOrganization(String tenant, List<Caller> organization) {
        if (reconciler.throttled(tenant)) {
            return new Run(0, 0, 0, 0, 1);
        }
        if (!hasReadyTeamsLine(tenant)) {
            return Run.NOTHING;
        }
        int operators = organization.size();
        try {
            int recorded = reconciler.reconcileOperators(tenant,
                    organization.stream().map(Caller::performedBy).toList()).recorded();
            return new Run(1, operators, recorded, 0);
        } catch (TelephonyThrottledException e) {
            LOG.warnf("Teams call reconcile throttled by Graph for an organization; waiting %ds",
                    e.retryAfter().toSeconds());
            return new Run(1, operators, 0, operators, 1);
        } catch (RuntimeException e) {
            LOG.warnf("Teams call reconcile failed for an organization: %s", e.getMessage());
            return new Run(1, operators, 0, operators);
        }
    }

    private static List<List<Caller>> byOrganization(List<Caller> callers) {
        List<List<Caller>> groups = new ArrayList<>();
        for (Caller caller : callers) {
            List<Caller> last = groups.isEmpty() ? null : groups.getLast();
            if (last != null && last.getFirst().tenantCode().equals(caller.tenantCode())) {
                last.add(caller);
            } else {
                groups.add(new ArrayList<>(List.of(caller)));
            }
        }
        return groups;
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
