package com.microboxlabs.miot.teltonika.command;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A period of high-frequency reporting for one device ({@code miot_teltonika.intensive_tracking}).
 *
 * @param previousParams the device's own values before the change, {@code id:value;id:value}, read
 *                       with {@code getparam}; restored at the end when complete
 * @param endedAt        when the standard frequency was requested back
 * @param restoredAt     when the device confirmed it; until then the restore is retried
 */
public record IntensiveTracking(String imei, String tenantCode, OffsetDateTime startedAt, OffsetDateTime until,
        String reason, String requestedBy, String previousParams, OffsetDateTime endedAt, OffsetDateTime restoredAt) {

    public boolean active() {
        return endedAt == null;
    }

    public Map<Integer, String> previous() {
        Map<Integer, String> out = new LinkedHashMap<>();
        if (previousParams != null && !previousParams.isBlank()) {
            for (String pair : previousParams.split(";")) {
                int colon = pair.indexOf(':');
                if (colon > 0) {
                    out.put(Integer.parseInt(pair.substring(0, colon)), pair.substring(colon + 1));
                }
            }
        }
        return out;
    }
}
