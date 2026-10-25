package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.MonitorSelector;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import java.util.List;
import java.util.Optional;

/** Trip monitors, one row per version, and each tenant's selector. Every call is tenant-scoped. */
public interface MonitorStore {

    /** Serializes mutations of one monitor (or the reserved _selector key) until transaction end. */
    void lock(String tenantCode, String monitorKey);

    /** Every version of every monitor of the tenant, by key and newest version first. */
    List<TripMonitor> all(String tenantCode);

    /** The monitor's versions, newest first; the draft, if any, is the first. */
    List<TripMonitor> versions(String tenantCode, String monitorKey);

    Optional<TripMonitor> version(String tenantCode, String monitorKey, int version);

    /** Replaces the draft, or creates it as the version after the newest one. */
    TripMonitor saveDraft(TripMonitor draft);

    /** The draft becomes a published version; empty when there is no draft. */
    Optional<TripMonitor> publish(String tenantCode, String monitorKey, String actor);

    /** True when there was a draft. */
    boolean deleteDraft(String tenantCode, String monitorKey);

    List<MonitorSelector> selector(String tenantCode);

    /** Replaces the whole selector. Call it in a transaction. */
    void saveSelector(String tenantCode, List<MonitorSelector> entries, String actor);
}
