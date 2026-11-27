package com.microboxlabs.miot.teltonika.monitor;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Device health and the packet log. Blocking; the receiver writes in batches off the event loop. */
public interface MonitorStore {

    /** Adds the counters and replaces the last values of each delta (newer values win). */
    void applyStatus(Collection<StatusDelta> deltas);

    Optional<DeviceStatus> status(String imei);

    void appendPackets(Collection<PacketLogEntry> entries);

    List<PacketLogEntry> packets(String imei, int limit);

    /** Forgets what an installation check relies on (ignition and iButton sightings), e.g. after a reassignment. */
    void resetSightings(String imei);

    /** Packets kept while the device had not proved possession, oldest first. */
    List<PendingPacket> pendingActivation(String imei);

    /**
     * Marks these pending packets as replayed once their records were published. Only these: a
     * packet kept while the replay ran stays pending for the next one.
     */
    void markReplayed(String imei, Collection<Long> ids);

    /** Devices with packets still pending activation (to replay those whose device is already active). */
    List<String> devicesWithPendingPackets();

    /** Applies the retention: drops partitions older than it (deletes rows in the in-memory store). */
    void applyRetention(OffsetDateTime before);
}
