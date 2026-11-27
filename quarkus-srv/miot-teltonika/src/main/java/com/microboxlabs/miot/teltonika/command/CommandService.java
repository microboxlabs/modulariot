package com.microboxlabs.miot.teltonika.command;

import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.guide.ConnectionGuide;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jboss.logging.Logger;

/**
 * Queues Codec 12 commands and runs intensive tracking. From the API only a closed list is accepted:
 * queries, {@code getparam} of non-secret parameters, and {@code setparam} of the reporting-frequency
 * parameters within safe ranges. Anything that acts on the vehicle (digital outputs) is not offered.
 *
 * <p>Intensive tracking reads the device's own frequency first ({@code getparam}), raises it, and at
 * the end restores those values (the standard profile if they could not be read). The restore is
 * retried until the device confirms it ({@code New value ...}).
 */
public final class CommandService {

    private static final Logger LOG = Logger.getLogger(CommandService.class);

    /** Read-only queries the device answers with its state. */
    public static final Set<String> QUERIES = Set.of("getinfo", "getver", "getgps", "getio", "getstatus");
    /** Parameters that may be read: the connection guide and frequency ones, never APN or keys. */
    public static final Set<Integer> READABLE = Set.of(2004, 2005, 2006, 2010, 2015, 113, 1001, 1002, 101, 102,
            10000, 10004, 10005, 10050, 10051, 10052, 10054, 10055);
    /**
     * Frequency parameters an organization may change, with the range allowed. Narrower than the
     * device's: a device must not be left reporting every second or holding its data for hours.
     */
    public static final Map<Integer, int[]> WRITABLE = Map.of(
            10000, new int[] {60, 3600},      // Min period, stopped (s)
            10004, new int[] {1, 10},         // Min saved records, stopped
            10005, new int[] {30, 3600},      // Send period, stopped (s)
            10050, new int[] {5, 600},        // Min period, moving (s)
            10051, new int[] {0, 5000},       // Min distance, moving (m; 0 off)
            10052, new int[] {0, 90},         // Min angle, moving (°; 0 off)
            10054, new int[] {1, 10},         // Min saved records, moving
            10055, new int[] {5, 600});       // Send period, moving (s)
    /** The frequency parameters intensive tracking changes and restores. */
    static final List<Integer> INTENSIVE_PARAMS = List.of(10050, 10055, 10000, 10005);

    private static final Pattern SETPARAM = Pattern.compile("^setparam (\\d+:\\d+)(;\\d+:\\d+)*$");
    private static final Pattern GETPARAM = Pattern.compile("^getparam (\\d+)$");
    private static final Pattern VALUE = Pattern.compile("Value:\\s*(\\S*)", Pattern.CASE_INSENSITIVE);
    public static final Duration COMMAND_TTL = Duration.ofHours(24);
    /** A restore waits much longer: a truck may spend days without coverage at a mine site. */
    public static final Duration RESTORE_TTL = Duration.ofDays(30);
    public static final Duration MAX_INTENSIVE = Duration.ofHours(12);

    /** Longest {@code setparam} sent in one command (the column holds 512). */
    static final int MAX_COMMAND = 480;

    private final CommandStore store;
    private final Clock clock;
    private final Function<String, Map<Integer, String>> baseline;

    public CommandService(CommandStore store, Clock clock) {
        this(store, clock, imei -> Map.of());
    }

    /**
     * @param baseline the configuration profile values of a device (empty without profile): a restore
     *                 falls back to them for values the device did not report
     */
    public CommandService(CommandStore store, Clock clock, Function<String, Map<Integer, String>> baseline) {
        this.store = store;
        this.clock = clock;
        this.baseline = baseline;
    }

    /**
     * Sends a configuration profile to a device: one or more {@code setparam} commands, in order.
     * The values were validated when the profile was saved.
     */
    public List<DeviceCommand> applyProfile(Device device, Map<Integer, String> params, String actor) {
        requireActive(device);
        List<DeviceCommand> out = new ArrayList<>();
        StringBuilder chunk = new StringBuilder();
        for (var e : params.entrySet()) {
            String pair = e.getKey() + ":" + e.getValue();
            if (!chunk.isEmpty() && "setparam ".length() + chunk.length() + 1 + pair.length() > MAX_COMMAND) {
                out.add(enqueue(device.imei(), device.tenantCode(), true, "setparam " + chunk, DeviceCommand.PROFILE,
                        actor, COMMAND_TTL));
                chunk.setLength(0);
            }
            if (!chunk.isEmpty()) {
                chunk.append(';');
            }
            chunk.append(pair);
        }
        if (!chunk.isEmpty()) {
            out.add(enqueue(device.imei(), device.tenantCode(), true, "setparam " + chunk, DeviceCommand.PROFILE,
                    actor, COMMAND_TTL));
        }
        return out;
    }

    /** A command requested through the API; refused unless it is in the closed list. */
    public DeviceCommand request(Device device, String command, String actor) {
        return enqueue(device.imei(), device.tenantCode(), requireActive(device), normalize(command),
                DeviceCommand.MANUAL, actor, COMMAND_TTL);
    }

    public List<DeviceCommand> list(String imei, int limit) {
        return store.list(imei, Math.min(Math.max(limit, 1), 200));
    }

    public IntensiveTracking startIntensive(Device device, Duration duration, String reason, String actor) {
        requireActive(device);
        if (device.activatedAt() == null) {
            throw new IllegalStateException("the device has not been activated");
        }
        if (duration.compareTo(Duration.ofMinutes(1)) < 0 || duration.compareTo(MAX_INTENSIVE) > 0) {
            throw new IllegalArgumentException("duration must be between 1 minute and " + MAX_INTENSIVE.toHours() + " h");
        }
        Optional<IntensiveTracking> current = store.intensive(device.imei());
        if (current.isPresent() && (current.get().active() || current.get().restoredAt() == null)) {
            throw new IllegalStateException("the device is already in intensive tracking or still restoring");
        }
        OffsetDateTime now = now();
        var tracking = new IntensiveTracking(device.imei(), device.tenantCode(), now, now.plus(duration), reason,
                actor, null, null, null);
        store.saveIntensive(tracking);
        for (int id : INTENSIVE_PARAMS) {
            enqueue(device.imei(), device.tenantCode(), true, "getparam " + id, DeviceCommand.INTENSIVE_READ, actor,
                    COMMAND_TTL);
        }
        enqueue(device.imei(), device.tenantCode(), true, ConnectionGuide.setparam(ConnectionGuide.intensiveProfile()),
                DeviceCommand.INTENSIVE_START, actor, COMMAND_TTL);
        return tracking;
    }

    /** Ends intensive tracking and queues the restore; false if it was already ended. */
    public boolean endIntensive(String imei, String tenantCode, String actor) {
        if (!store.endIntensive(imei, now())) {
            return false;
        }
        store.intensive(imei).ifPresent(t -> enqueueRestore(t, actor));
        return true;
    }

    /** Ends every intensive period whose time passed; returns how many. Run in one instance. */
    public int endDue() {
        int n = 0;
        for (IntensiveTracking t : store.dueIntensive(now())) {
            if (endIntensive(t.imei(), t.tenantCode(), "scheduler")) {
                n++;
            }
        }
        return n;
    }

    /** Queues the restore again for ended periods the device has not confirmed. Run in one instance. */
    public int retryRestores() {
        int n = 0;
        for (IntensiveTracking t : store.unrestored()) {
            if (!store.hasOpen(t.imei(), DeviceCommand.INTENSIVE_END)) {
                enqueueRestore(t, "scheduler");
                n++;
            }
        }
        if (n > 0) {
            LOG.warnf("Intensive tracking restore queued again for %d device(s) that have not confirmed it", n);
        }
        return n;
    }

    /** Devices whose frequency was raised and not confirmed back; exposed as a metric. */
    public int unrestoredCount() {
        return store.unrestored().size();
    }

    /** What an answer means for intensive tracking: a value read, or the restore confirmed. */
    public void answered(DeviceCommand c, String response) {
        switch (c.purpose()) {
            case DeviceCommand.INTENSIVE_READ -> {
                Matcher id = GETPARAM.matcher(c.command());
                Matcher value = VALUE.matcher(response == null ? "" : response);
                if (id.matches() && value.find() && !value.group(1).isBlank()) {
                    int param = Integer.parseInt(id.group(1));
                    String v = value.group(1).trim();
                    int[] range = WRITABLE.get(param);
                    // Only a number inside the parameter's range is kept: the restore concatenates it
                    // into a setparam, so anything else (";2004:host") would write other parameters.
                    if (range != null && v.matches("[0-9]{1,9}") && Long.parseLong(v) >= range[0]
                            && Long.parseLong(v) <= range[1]) {
                        store.addPreviousParam(c.imei(), param, v);
                    } else {
                        LOG.warnf("Intensive tracking: value read for %d not kept, the profile value will be restored:"
                                + " imei=%s", param, c.imei());
                    }
                }
            }
            case DeviceCommand.INTENSIVE_END -> {
                if (response != null && response.toLowerCase(Locale.ROOT).contains("new value")) {
                    store.markRestored(c.imei(), now());
                }
            }
            default -> {
                // Manual and other answers are only saved.
            }
        }
    }

    /**
     * Each value: what the device had (read at the start), else its configuration profile's, else the
     * standard profile's.
     */
    private void enqueueRestore(IntensiveTracking t, String actor) {
        Map<Integer, String> previous = t.previous();
        Map<Integer, String> profile = baseline.apply(t.imei());
        Map<Integer, String> standard = new java.util.HashMap<>();
        ConnectionGuide.standardProfile().forEach(p -> standard.put(p.id(), p.value()));
        String restore = "setparam " + INTENSIVE_PARAMS.stream()
                .map(id -> id + ":" + previous.getOrDefault(id, profile.getOrDefault(id, standard.get(id))))
                .reduce((a, b) -> a + ";" + b).orElseThrow();
        enqueue(t.imei(), t.tenantCode(), true, restore, DeviceCommand.INTENSIVE_END, actor, RESTORE_TTL);
    }

    private DeviceCommand enqueue(String imei, String tenantCode, boolean active, String command, String purpose,
            String actor, Duration ttl) {
        if (!active) {
            throw new IllegalStateException("the device is inactive");
        }
        OffsetDateTime now = now();
        var c = new DeviceCommand(UUID.randomUUID(), imei, tenantCode, command, purpose, DeviceCommand.PENDING, null,
                actor, now, null, null, now.plus(ttl));
        store.insert(c);
        return c;
    }

    /** Queues the possession check of a pending device, unless one is open already. */
    public void requestActivationCheck(String imei, String tenantCode) {
        if (!store.hasOpen(imei, DeviceCommand.ACTIVATION)) {
            enqueue(imei, tenantCode, true, "getparam " + ConnectionGuide.ACTIVATION_PARAM, DeviceCommand.ACTIVATION,
                    "activation", Duration.ofHours(1));
        }
    }

    private static boolean requireActive(Device device) {
        if (!device.active()) {
            throw new IllegalStateException("the device is inactive");
        }
        return true;
    }

    static String normalize(String command) {
        if (command == null || command.isBlank()) {
            throw new IllegalArgumentException("command is required");
        }
        String c = command.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        if (QUERIES.contains(c)) {
            return c;
        }
        Matcher get = GETPARAM.matcher(c);
        if (get.matches()) {
            int id = Integer.parseInt(get.group(1));
            if (!READABLE.contains(id)) {
                throw new IllegalArgumentException("parameter " + id + " cannot be read remotely; allowed: "
                        + READABLE.stream().sorted().toList());
            }
            return c;
        }
        if (SETPARAM.matcher(c).matches()) {
            for (String pair : c.substring("setparam ".length()).split(";")) {
                int colon = pair.indexOf(':');
                int id = Integer.parseInt(pair.substring(0, colon));
                long value = Long.parseLong(pair.substring(colon + 1));
                int[] range = WRITABLE.get(id);
                if (range == null) {
                    throw new IllegalArgumentException("parameter " + id + " cannot be changed remotely; allowed: "
                            + WRITABLE.keySet().stream().sorted().toList());
                }
                if (value < range[0] || value > range[1]) {
                    throw new IllegalArgumentException("parameter " + id + " must be between " + range[0] + " and "
                            + range[1]);
                }
            }
            return c;
        }
        throw new IllegalArgumentException("command must be one of " + QUERIES.stream().sorted().toList()
                + ", getparam of a readable parameter, or setparam of the reporting-frequency parameters");
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }
}
