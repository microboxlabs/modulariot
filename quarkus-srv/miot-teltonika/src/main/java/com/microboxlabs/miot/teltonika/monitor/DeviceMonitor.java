package com.microboxlabs.miot.teltonika.monitor;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.jboss.logging.Logger;

/**
 * Collects device status and kept packets in memory and writes them in batches ({@link #flush}),
 * so the sessions never wait for the database. The packet queue is bounded: when the database is
 * slower than the traffic, packets beyond the bound are dropped and counted, never blocking a device.
 */
public final class DeviceMonitor {

    private static final Logger LOG = Logger.getLogger(DeviceMonitor.class);
    /** A device not heard for this long leaves memory after its last flush. */
    private static final Duration IDLE_EVICTION = Duration.ofHours(1);

    private final MonitorStore store;
    private final Map<String, StatusDelta> deltas = new ConcurrentHashMap<>();
    private final Map<String, Instant> lastTouched = new ConcurrentHashMap<>();
    private final BlockingQueue<PacketLogEntry> packets;
    private final AtomicLong droppedPackets = new AtomicLong();

    public DeviceMonitor(MonitorStore store, int packetQueueSize) {
        this.store = store;
        this.packets = new ArrayBlockingQueue<>(packetQueueSize);
    }

    public StatusDelta status(String imei) {
        lastTouched.put(imei, Instant.now());
        return deltas.computeIfAbsent(imei, StatusDelta::new);
    }

    public void keep(PacketLogEntry entry) {
        if (!packets.offer(entry)) {
            long dropped = droppedPackets.incrementAndGet();
            if (dropped == 1 || dropped % 1000 == 0) {
                LOG.warnf("Packet log queue full: %d packets not kept so far", dropped);
            }
        }
    }

    /**
     * Writes a packet now. Blocking: the receiver calls it before acknowledging a packet whose
     * records are not published, so nothing acknowledged exists only in memory. Throws if it fails.
     */
    public void keepDurably(PacketLogEntry entry) {
        store.appendPackets(List.of(entry));
    }

    /** Writes pending status and packets. Blocking; runs on a worker. */
    public void flush() {
        List<StatusDelta> batch = new ArrayList<>();
        for (StatusDelta d : deltas.values()) {
            if (!d.isEmpty()) {
                batch.add(d.drain());
            }
        }
        try {
            store.applyStatus(batch);
        } catch (RuntimeException e) {
            // Counters go back to their deltas for the next flush; last values are kept there anyway.
            batch.forEach(failed -> {
                StatusDelta live = deltas.get(failed.imei());
                if (live != null) {
                    live.restore(failed);
                }
            });
            LOG.warnf(e, "Device status flush failed for %d devices; retrying next round", batch.size());
        }
        List<PacketLogEntry> kept = new ArrayList<>();
        packets.drainTo(kept, 5_000);
        try {
            store.appendPackets(kept);
        } catch (RuntimeException e) {
            LOG.warnf(e, "Packet log flush failed: %d packets lost", kept.size());
        }
        Instant cutoff = Instant.now().minus(IDLE_EVICTION);
        lastTouched.entrySet().removeIf(e -> {
            if (e.getValue().isBefore(cutoff)) {
                deltas.remove(e.getKey());
                return true;
            }
            return false;
        });
    }

    public long droppedPackets() {
        return droppedPackets.get();
    }

    public int pendingPackets() {
        return packets.size();
    }
}
