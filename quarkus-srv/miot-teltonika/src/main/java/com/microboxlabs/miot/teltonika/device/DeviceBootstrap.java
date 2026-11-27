package com.microboxlabs.miot.teltonika.device;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import org.jboss.logging.Logger;

/**
 * Registers the devices listed in {@code miot.teltonika.bootstrap-devices} when they are missing, so a
 * local environment and the emulator work without calling the API first. Entries are
 * {@code "<imei>"=<tenant code>/<asset id>}. Bootstrap devices are activated directly (no possession
 * proof) and their assignment covers any buffered record. Existing devices are never changed.
 * Development only: production registers devices through the API.
 */
public final class DeviceBootstrap {

    private static final Logger LOG = Logger.getLogger(DeviceBootstrap.class);
    static final String ACTOR = "bootstrap";
    private static final OffsetDateTime SINCE = OffsetDateTime.parse("2000-01-01T00:00:00Z");

    private DeviceBootstrap() {
    }

    public static int apply(DeviceStore store, Map<String, String> entries) {
        int added = 0;
        for (var e : entries.entrySet()) {
            String imei = Device.requireImei(e.getKey().replace("\"", ""));
            String[] parts = e.getValue().split("/", 2);
            if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
                throw new IllegalArgumentException("bootstrap device " + imei + " must be <tenant code>/<asset id>");
            }
            if (store.find(imei).isPresent()) {
                continue;
            }
            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
            store.register(new Device(imei, parts[0].trim(), "FMB920", "bootstrap", true, null, now, null, null,
                    now, ACTOR, now, ACTOR), parts[1].trim(), SINCE, ACTOR);
            added++;
        }
        if (added > 0) {
            LOG.infof("Bootstrap registered %d device(s)", added);
        }
        return added;
    }
}
