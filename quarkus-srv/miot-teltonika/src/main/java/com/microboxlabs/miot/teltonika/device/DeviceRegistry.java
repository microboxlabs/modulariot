package com.microboxlabs.miot.teltonika.device;

import java.util.Optional;

/**
 * Devices allowed to send data, by IMEI. A device not found (or inactive) is rejected at connection
 * time, and an open session is closed when its device is deactivated.
 */
public interface DeviceRegistry {

    Optional<RegisteredDevice> find(String imei);

    /** Forget the cached entry so the next lookup reads the store. */
    default void invalidate(String imei) {
    }
}
