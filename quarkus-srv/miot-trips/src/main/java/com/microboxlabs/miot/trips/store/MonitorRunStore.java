package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.MonitorRun;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The monitor state of each trip, its timers and its transitions. Every call but {@link #claimDue} is per trip. */
public interface MonitorRunStore {

    /** Inside a transaction the row stays locked until it ends. */
    Optional<MonitorRun.State> state(String tenantCode, UUID tripId);

    /** Creates or replaces the trip's monitor; the epoch starts again at 0. */
    MonitorRun.State bind(String tenantCode, UUID tripId, String monitorKey, int monitorVersion, String actor);

    /** Raises the epoch by one and returns the new value. */
    int nextEpoch(String tenantCode, UUID tripId);

    /** Removes the timers that have not fired. */
    void dropPendingTimers(String tenantCode, UUID tripId);

    /** True when this monitor version evaluated the timer at that time on the trip. */
    boolean fired(String tenantCode, UUID tripId, String monitorKey, int monitorVersion, String ruleKey,
            OffsetDateTime dueAt);

    /** Retains an unchanged timer, including its claim, in the new scheduling epoch. */
    void retainTimer(long id, int epoch);

    /** Removes pending timers not retained or scheduled in this epoch. */
    void dropObsoleteTimers(String tenantCode, UUID tripId, int epoch);

    void schedule(String tenantCode, UUID tripId, String ruleKey, int monitorVersion, OffsetDateTime dueAt,
            int epoch);

    /** Locks the timer row; empty when it is gone. */
    Optional<MonitorRun.Timer> timer(long id);

    void markFired(long id);

    List<MonitorRun.Timer> pendingTimers(String tenantCode, UUID tripId);

    /**
     * Across tenants: claims up to {@code limit} unfired timers due at {@code now} for {@code claimSeconds}, skipping
     * rows another pod holds. A claim that expires makes the timer due again.
     */
    List<MonitorRun.Timer> claimDue(OffsetDateTime now, int claimSeconds, int limit);

    void recordTransition(MonitorRun.Transition transition);

    /** True when an earlier transition of the trip recorded the alert {@code key}. */
    boolean alerted(String tenantCode, UUID tripId, String key);

    /** The trip's transitions, newest first. */
    List<MonitorRun.Transition> transitions(String tenantCode, UUID tripId, int limit);
}
