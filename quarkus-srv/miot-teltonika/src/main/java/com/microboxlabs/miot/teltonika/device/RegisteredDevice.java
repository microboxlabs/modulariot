package com.microboxlabs.miot.teltonika.device;

import com.microboxlabs.miot.teltonika.inputs.InputMapping;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * A device as the receiver sees it: whom its records belong to, which asset each record reports
 * for (by record time) and whether it proved possession yet. A pending device may connect; its
 * packets are kept, not published, until it is activated.
 */
public record RegisteredDevice(String imei, String tenantCode, String model, boolean activated,
        OffsetDateTime captureUntil, List<Assignment> assignments, List<InputMapping> inputs) {

    public RegisteredDevice {
        assignments = List.copyOf(assignments);
        inputs = List.copyOf(inputs);
    }

    public RegisteredDevice(String imei, String tenantCode, String model, boolean activated,
            OffsetDateTime captureUntil, List<Assignment> assignments) {
        this(imei, tenantCode, model, activated, captureUntil, assignments, List.of());
    }

    public static RegisteredDevice of(Device d, List<Assignment> assignments) {
        return of(d, assignments, List.of());
    }

    /** With what is wired to its inputs (from its input profile). */
    public static RegisteredDevice of(Device d, List<Assignment> assignments, List<InputMapping> inputs) {
        return new RegisteredDevice(d.imei(), d.tenantCode(), d.model(), d.activatedAt() != null, d.captureUntil(),
                assignments, inputs);
    }

    /** The asset the device reported for at {@code recordTime}; empty when no assignment covers it. */
    public Optional<String> assetAt(Instant recordTime) {
        return assignments.stream().filter(a -> a.covers(recordTime)).map(Assignment::assetId).findFirst();
    }

    /** Whether every packet must be kept (installation capture). */
    public boolean capturing(Instant now) {
        return captureUntil != null && captureUntil.toInstant().isAfter(now);
    }
}
