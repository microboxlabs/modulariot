package com.microboxlabs.miot.teltonika.device;

import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jboss.logging.Logger;

/**
 * The receiver's view of the device registry: every active device in memory, so a connection or a
 * packet never waits for the database. {@link #reload()} replaces the whole view (periodically, so
 * changes made on another pod arrive within the refresh period); {@link #invalidate} refreshes one
 * device right after an API change on this pod. A device invalidated while a reload was reading is
 * read again before the reload publishes its view, so the reload never brings back a stale entry.
 * Blocking: call both off the event loop.
 */
public final class CachedDeviceRegistry implements DeviceRegistry {

    private static final Logger LOG = Logger.getLogger(CachedDeviceRegistry.class);

    private final DeviceStore store;
    private final Object lock = new Object();
    private volatile Map<String, RegisteredDevice> devices = Map.of();
    private Set<String> invalidatedDuringReload;

    public CachedDeviceRegistry(DeviceStore store) {
        this.store = store;
    }

    @Override
    public Optional<RegisteredDevice> find(String imei) {
        return Optional.ofNullable(devices.get(imei));
    }

    /** Reads every active device; keeps the previous view if the store fails. */
    public int reload() {
        synchronized (lock) {
            invalidatedDuringReload = new HashSet<>();
        }
        Map<String, RegisteredDevice> fresh;
        try {
            fresh = new ConcurrentHashMap<>(store.activeDevices().stream()
                    .collect(Collectors.toMap(RegisteredDevice::imei, Function.identity())));
        } catch (RuntimeException e) {
            synchronized (lock) {
                invalidatedDuringReload = null;
            }
            LOG.warnf(e, "Device registry reload failed; keeping %d cached devices", devices.size());
            return -1;
        }
        synchronized (lock) {
            for (String imei : invalidatedDuringReload) {
                put(fresh, imei);
            }
            invalidatedDuringReload = null;
            devices = fresh;
            return fresh.size();
        }
    }

    @Override
    public void invalidate(String imei) {
        synchronized (lock) {
            Map<String, RegisteredDevice> next = new ConcurrentHashMap<>(devices);
            put(next, imei);
            devices = next;
            if (invalidatedDuringReload != null) {
                invalidatedDuringReload.add(imei);
            }
        }
    }

    private void put(Map<String, RegisteredDevice> map, String imei) {
        store.find(imei).filter(Device::active).ifPresentOrElse(
                d -> map.put(imei, RegisteredDevice.of(d, store.assignments(imei),
                        store.inputMappings(d.inputProfileId()))),
                () -> map.remove(imei));
    }

    public int size() {
        return devices.size();
    }
}
