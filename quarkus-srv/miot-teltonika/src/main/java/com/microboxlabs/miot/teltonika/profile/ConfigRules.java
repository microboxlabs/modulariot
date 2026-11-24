package com.microboxlabs.miot.teltonika.profile;

import com.microboxlabs.miot.teltonika.command.CommandService;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Parameters a configuration profile may set, with their allowed values. Teltonika FMB parameter
 * list (FMB.Ver.03.29): frequency within the same safe ranges as remote commands, ignition source
 * (101), sleep (102), ignition voltage thresholds (104/105) and the I/O element settings (50000-59999,
 * six per element: priority, operand, high level, low level, event only, average).
 * Server, APN and keys are never part of a profile.
 */
public final class ConfigRules {

    private ConfigRules() {
    }

    /** Validates and returns the parameters in a stable order. */
    public static Map<Integer, String> validate(Map<Integer, String> params) {
        if (params == null || params.isEmpty()) {
            throw new IllegalArgumentException("a profile needs at least one parameter");
        }
        if (params.size() > 120) {
            throw new IllegalArgumentException("a profile has at most 120 parameters");
        }
        Map<Integer, String> out = new LinkedHashMap<>();
        params.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(e -> {
            int id = e.getKey();
            long v = value(id, e.getValue());
            long[] range = range(id);
            if (range == null) {
                throw new IllegalArgumentException("parameter " + id + " cannot be part of a profile");
            }
            if (v < range[0] || v > range[1]) {
                throw new IllegalArgumentException("parameter " + id + " must be between " + range[0] + " and "
                        + range[1]);
            }
            out.put(id, Long.toString(v));
        });
        return out;
    }

    static long[] range(int id) {
        int[] frequency = CommandService.WRITABLE.get(id);
        if (frequency != null) {
            return new long[] {frequency[0], frequency[1]};
        }
        return switch (id) {
            case 101 -> new long[] {1, 15};          // ignition source bitmask: 1 DIN1, 2 accel, 4 voltage, 8 RPM
            // sleep: 0 off, 1 GPS sleep. Deep sleep (2-4) drops the data connection: commands stop
            // reaching the device, so a profile cannot set it.
            case 102 -> new long[] {0, 1};
            case 104, 105 -> new long[] {0, 60000};  // ignition voltage thresholds (mV)
            default -> id >= 50000 && id <= 59999 ? ioRange(id % 10) : null;
        };
    }

    private static long[] ioRange(int field) {
        return switch (field) {
            case 0 -> new long[] {0, 2};             // priority: 0 off, 1 low, 2 high (3 panic may send SMS)
            case 1 -> new long[] {0, 6};             // operand: on exit ... on delta change
            case 2, 3 -> new long[] {-2147483648L, 2147483647L}; // high / low level
            case 4 -> new long[] {0, 1};             // event only
            case 5 -> new long[] {0, 65535};         // average constant
            default -> null;
        };
    }

    private static long value(int id, String raw) {
        try {
            return Long.parseLong(raw == null ? "" : raw.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("parameter " + id + " must be a whole number");
        }
    }
}
