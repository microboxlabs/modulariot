package com.microboxlabs.miot.teltonika.server;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Command links of this receiver instance (TCP sessions, MQTT devices), one per IMEI. A second connection with the same IMEI
 * replaces the first (the device reconnected, or someone else is using its IMEI): the old one is
 * closed and the event is counted and logged with both addresses.
 */
public final class SessionRegistry {

    private final Map<String, CommandLink> byImei = new ConcurrentHashMap<>();

    /** Registers {@code session}; returns the session it replaced, if any. */
    public Optional<CommandLink> register(String imei, CommandLink session) {
        return Optional.ofNullable(byImei.put(imei, session)).filter(previous -> previous != session);
    }

    public void unregister(String imei, CommandLink session) {
        byImei.remove(imei, session);
    }

    public Optional<CommandLink> find(String imei) {
        return Optional.ofNullable(byImei.get(imei));
    }

    public Collection<String> connectedImeis() {
        return List.copyOf(byImei.keySet());
    }

    public Collection<CommandLink> sessions() {
        return List.copyOf(byImei.values());
    }

    public int size() {
        return byImei.size();
    }
}
