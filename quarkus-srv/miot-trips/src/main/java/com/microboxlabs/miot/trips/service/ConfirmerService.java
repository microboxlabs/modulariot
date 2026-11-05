package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.store.ConfirmerStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Which team confirms each milestone of a monitor's trips. A person confirms or rejects a milestone through the UI or
 * the API only when it has no team or the person belongs to it. The feed and notice replies are not checked: the feed
 * runs as the tenant's service account and a reply comes from the address the notice was sent to.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class ConfirmerService {

    private static final String ENTITY = "trip_monitor";

    private final ConfirmerStore store;
    private final MonitorService monitors;
    private final AuditService audit;
    private final Transactions tx;

    @Inject
    public ConfirmerService(ConfirmerStore store, MonitorService monitors, AuditService audit, Transactions tx) {
        this.store = store;
        this.monitors = monitors;
        this.audit = audit;
        this.tx = tx;
    }

    public Map<String, UUID> ofMonitor(String tenantCode, String monitorKey) {
        monitors.get(tenantCode, monitorKey);
        return store.ofMonitor(tenantCode, monitorKey);
    }

    public Map<String, UUID> ofTrip(String tenantCode, UUID tripId) {
        return store.ofTrip(tenantCode, tripId);
    }

    /** {@code orgTeams} are the organization's teams: a team outside it is refused. */
    public Map<String, UUID> save(String tenantCode, String actor, String monitorKey, Map<String, UUID> teams,
            Set<UUID> orgTeams) {
        monitors.get(tenantCode, monitorKey);
        Map<String, UUID> clean = new LinkedHashMap<>();
        (teams == null ? Map.<String, UUID>of() : teams).forEach((milestone, team) -> {
            if (!TripMilestone.MILESTONES.contains(milestone)) {
                throw new IllegalArgumentException("milestone must be one of " + TripMilestone.MILESTONES);
            }
            if (team != null) {
                if (!orgTeams.contains(team)) {
                    throw new IllegalArgumentException("team " + team + " is not a team of the organization");
                }
                clean.put(milestone, team);
            }
        });
        return tx.inTransaction(() -> {
            store.replace(tenantCode, monitorKey, clean, actor);
            audit.log(tenantCode, actor, "monitor.confirmers_saved", ENTITY, monitorKey, null,
                    Map.of("teams", clean.entrySet().stream()
                            .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().toString()))));
            return clean;
        });
    }

    /**
     * Refuses a person outside the team of the trip's milestone. {@code callerTeams} null means the caller is not a
     * person (a service account or a client), which the permission alone admits.
     */
    public void require(String tenantCode, UUID tripId, String milestone, Set<UUID> callerTeams) {
        if (callerTeams == null) {
            return;
        }
        UUID team = store.ofTrip(tenantCode, tripId).get(milestone);
        if (team != null && !callerTeams.contains(team)) {
            throw new SecurityException("only the team " + team + " confirms the " + milestone + " of this trip");
        }
    }
}
