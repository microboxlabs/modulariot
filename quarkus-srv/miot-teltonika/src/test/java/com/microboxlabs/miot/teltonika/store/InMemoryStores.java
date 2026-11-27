package com.microboxlabs.miot.teltonika.store;

import com.microboxlabs.miot.teltonika.command.CommandStore;
import com.microboxlabs.miot.teltonika.command.DeviceCommand;
import com.microboxlabs.miot.teltonika.command.IntensiveTracking;
import com.microboxlabs.miot.teltonika.device.Assignment;
import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.device.DeviceStore;
import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.inputs.InputMapping;
import com.microboxlabs.miot.teltonika.inputs.InputProfile;
import com.microboxlabs.miot.teltonika.profile.ConfigProfile;
import com.microboxlabs.miot.teltonika.profile.ProfileStore;
import com.microboxlabs.miot.teltonika.monitor.DeviceStatus;
import com.microboxlabs.miot.teltonika.monitor.MonitorStore;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.monitor.StatusDelta;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** In-memory versions of the three stores, with the same rules the PostgreSQL ones enforce. */
public final class InMemoryStores {

    private InMemoryStores() {
    }

    /** {@link DeviceStore}. */
    public static final class Devices implements DeviceStore {
        private final Map<String, Device> devices = new ConcurrentHashMap<>();
        private final List<Assignment> assignments = new CopyOnWriteArrayList<>();
        private final Profiles profiles;

        public Devices() {
            this(new Profiles());
        }

        Devices(Profiles profiles) {
            this.profiles = profiles;
            profiles.devices = this;
        }

        @Override
        public List<InputMapping> inputMappings(UUID inputProfileId) {
            return inputProfileId == null ? List.of()
                    : profiles.inputProfile(inputProfileId).map(InputProfile::mappings).orElse(List.of());
        }

        @Override
        public List<Device> pendingClaims() {
            return devices.values().stream().filter(Device::pending)
                    .sorted(Comparator.comparing(Device::createdAt)).toList();
        }

        @Override
        public Optional<Device> find(String imei) {
            return Optional.ofNullable(devices.get(imei));
        }

        @Override
        public List<Device> list(String tenantCode, Boolean active) {
            return devices.values().stream().filter(d -> d.tenantCode().equals(tenantCode))
                    .filter(d -> active == null || d.active() == active)
                    .sorted(Comparator.comparing(Device::imei)).toList();
        }

        @Override
        public synchronized void register(Device device, String assetId, OffsetDateTime assignedFrom, String actor) {
            if (devices.putIfAbsent(device.imei(), device) != null) {
                throw new IllegalStateException("a device with that IMEI is already registered");
            }
            assignments.add(new Assignment(device.imei(), assetId, assignedFrom, null, OffsetDateTime.now(), actor));
        }

        @Override
        public synchronized void deleteExpiredClaim(String imei) {
            Device d = devices.get(imei);
            // The caller checked the expiry with its own clock.
            if (d != null && d.activatedAt() == null) {
                devices.remove(imei);
                assignments.removeIf(a -> a.imei().equals(imei));
            }
        }

        @Override
        public boolean update(Device device) {
            return devices.replace(device.imei(), device) != null;
        }

        @Override
        public List<Assignment> assignments(String imei) {
            return assignments.stream().filter(a -> a.imei().equals(imei))
                    .sorted(Comparator.comparing(Assignment::validFrom).reversed()).toList();
        }

        @Override
        public synchronized void reassign(String imei, String assetId, OffsetDateTime at, String actor) {
            if (!devices.containsKey(imei)) {
                throw new IllegalArgumentException("the device is not registered");
            }
            closeAssignment(imei, at);
            assignments.add(new Assignment(imei, assetId, at, null, OffsetDateTime.now(), actor));
        }

        @Override
        public synchronized void closeAssignment(String imei, OffsetDateTime at) {
            assignments.replaceAll(a -> a.imei().equals(imei) && a.open()
                    ? new Assignment(a.imei(), a.assetId(), a.validFrom(), at, a.createdAt(), a.createdBy()) : a);
        }

        @Override
        public List<RegisteredDevice> activeDevices() {
            return devices.values().stream().filter(Device::active)
                    .map(d -> RegisteredDevice.of(d, assignments(d.imei()), inputMappings(d.inputProfileId())))
                    .toList();
        }
    }

    /** {@link MonitorStore}: keeps the deltas applied and the packets appended. */
    public static final class Monitor implements MonitorStore {
        public final List<StatusDelta> applied = new CopyOnWriteArrayList<>();
        public final List<PacketLogEntry> packets = new CopyOnWriteArrayList<>();
        /** Makes packet writes fail, as a database outage would. */
        public volatile boolean failWrites;
        private final Map<String, DeviceStatus> status = new ConcurrentHashMap<>();

        @Override
        public void applyStatus(Collection<StatusDelta> deltas) {
            for (StatusDelta d : deltas) {
                applied.add(d);
                DeviceStatus s = status.get(d.imei());
                status.put(d.imei(), merge(s, d));
            }
        }

        private static DeviceStatus merge(DeviceStatus s, StatusDelta d) {
            boolean newer = s == null || d.lastRecordAt() != null && (s.lastRecordAt() == null
                    || !d.lastRecordAt().isBefore(s.lastRecordAt()));
            return new DeviceStatus(d.imei(),
                    s == null || s.firstSeenAt() == null ? d.seenAt() : s.firstSeenAt(),
                    max(s == null ? null : s.lastSeenAt(), d.seenAt()),
                    max(s == null ? null : s.lastRecordAt(), d.lastRecordAt()),
                    d.remoteAddress() != null ? d.remoteAddress() : s == null ? null : s.lastRemoteAddress(),
                    (s == null ? 0 : s.connections()) + d.connections(),
                    (s == null ? 0 : s.packets()) + d.packets(),
                    (s == null ? 0 : s.recordsPublished()) + d.recordsPublished(),
                    (s == null ? 0 : s.crcErrors()) + d.crcErrors(),
                    (s == null ? 0 : s.quarantinedPackets()) + d.quarantinedPackets(),
                    (s == null ? 0 : s.recordsWithoutPosition()) + d.recordsWithoutPosition(),
                    (s == null ? 0 : s.recordsOutOfTime()) + d.recordsOutOfTime(),
                    newer ? d.latitude() : s.lastLatitude(), newer ? d.longitude() : s.lastLongitude(),
                    max(s == null ? null : s.lastFixAt(), d.fixAt()),
                    newer ? d.gnssStatus() : s.lastGnssStatus(), newer ? d.satellites() : s.lastSatellites(),
                    newer ? d.gsmSignal() : s.lastGsmSignal(),
                    newer ? d.externalVoltageMv() : s.lastExternalVoltageMv(),
                    newer ? d.batteryVoltageMv() : s.lastBatteryVoltageMv(),
                    newer ? d.sleepMode() : s.lastSleepMode(), newer ? d.dataMode() : s.lastDataMode(),
                    newer ? d.ignition() : s.lastIgnition(),
                    max(s == null ? null : s.ignitionOnSeenAt(), d.ignitionOnSeenAt()),
                    max(s == null ? null : s.ignitionOffSeenAt(), d.ignitionOffSeenAt()),
                    d.ibutton() != null ? d.ibutton() : s == null ? null : s.lastIbutton(),
                    max(s == null ? null : s.lastIbuttonAt(), d.ibuttonAt()),
                    newer && d.recordIntervalS() != null ? d.recordIntervalS()
                            : s == null ? null : s.lastRecordIntervalS());
        }

        private static OffsetDateTime max(OffsetDateTime a, OffsetDateTime b) {
            if (a == null) {
                return b;
            }
            return b == null || a.isAfter(b) ? a : b;
        }

        @Override
        public Optional<DeviceStatus> status(String imei) {
            return Optional.ofNullable(status.get(imei));
        }

        @Override
        public void appendPackets(Collection<PacketLogEntry> entries) {
            if (failWrites && !entries.isEmpty()) {
                throw new IllegalStateException("database unavailable");
            }
            packets.addAll(entries);
        }

        @Override
        public List<PacketLogEntry> packets(String imei, int limit) {
            return packets.stream().filter(p -> p.imei().equals(imei))
                    .sorted(Comparator.comparing(PacketLogEntry::receivedAt).reversed()).limit(limit).toList();
        }

        @Override
        public void resetSightings(String imei) {
            status.computeIfPresent(imei, (k, s) -> new DeviceStatus(s.imei(), s.firstSeenAt(), s.lastSeenAt(),
                    s.lastRecordAt(), s.lastRemoteAddress(), s.connections(), s.packets(), s.recordsPublished(),
                    s.crcErrors(), s.quarantinedPackets(), s.recordsWithoutPosition(), s.recordsOutOfTime(),
                    s.lastLatitude(), s.lastLongitude(), s.lastFixAt(), s.lastGnssStatus(), s.lastSatellites(),
                    s.lastGsmSignal(), s.lastExternalVoltageMv(), s.lastBatteryVoltageMv(), s.lastSleepMode(),
                    s.lastDataMode(), s.lastIgnition(), null, null, null, null, s.lastRecordIntervalS()));
        }

        @Override
        public synchronized List<com.microboxlabs.miot.teltonika.monitor.PendingPacket> pendingActivation(
                String imei) {
            List<com.microboxlabs.miot.teltonika.monitor.PendingPacket> out = new ArrayList<>();
            for (int i = 0; i < packets.size(); i++) {
                PacketLogEntry p = packets.get(i);
                if (p.imei().equals(imei) && PacketLogEntry.PENDING_ACTIVATION.equals(p.outcome())) {
                    out.add(new com.microboxlabs.miot.teltonika.monitor.PendingPacket(i, p));
                }
            }
            out.sort(Comparator.comparing(pp -> pp.entry().receivedAt()));
            return out;
        }

        @Override
        public synchronized void markReplayed(String imei, java.util.Collection<Long> ids) {
            for (Long id : ids) {
                PacketLogEntry p = packets.get(id.intValue());
                if (p.imei().equals(imei) && PacketLogEntry.PENDING_ACTIVATION.equals(p.outcome())) {
                    packets.set(id.intValue(), new PacketLogEntry(p.imei(), p.tenantCode(), p.receivedAt(),
                            p.remoteAddress(), PacketLogEntry.REPLAYED, p.reason(), p.codecId(), p.recordCount(),
                            p.packet(), p.format()));
                }
            }
        }

        @Override
        public synchronized List<String> devicesWithPendingPackets() {
            return packets.stream().filter(p -> PacketLogEntry.PENDING_ACTIVATION.equals(p.outcome()))
                    .map(PacketLogEntry::imei).distinct().toList();
        }

        @Override
        public void applyRetention(OffsetDateTime before) {
            packets.removeIf(p -> p.receivedAt().isBefore(before));
        }
    }

    /** {@link CommandStore}. */
    public static final class Commands implements CommandStore {
        /** Insertion order stands for the seq column: commands of the same instant keep their order. */
        private final Map<UUID, DeviceCommand> commands = java.util.Collections.synchronizedMap(
                new java.util.LinkedHashMap<>());
        private final Map<String, IntensiveTracking> intensive = new ConcurrentHashMap<>();

        @Override
        public void insert(DeviceCommand command) {
            commands.put(command.id(), command);
        }

        @Override
        public Optional<DeviceCommand> find(UUID id) {
            return Optional.ofNullable(commands.get(id));
        }

        @Override
        public List<DeviceCommand> list(String imei, int limit) {
            List<DeviceCommand> mine = new ArrayList<>(snapshot().stream().filter(c -> c.imei().equals(imei)).toList());
            java.util.Collections.reverse(mine);
            return mine.stream().limit(limit).toList();
        }

        @Override
        public List<DeviceCommand> pending(Collection<String> imeis, OffsetDateTime now, int limit) {
            return snapshot().stream()
                    .filter(c -> DeviceCommand.PENDING.equals(c.status()) && imeis.contains(c.imei())
                            && c.expiresAt().isAfter(now))
                    .limit(limit).toList();
        }

        @Override
        public boolean hasOpen(String imei, String purpose) {
            return snapshot().stream().anyMatch(c -> c.imei().equals(imei) && c.purpose().equals(purpose)
                    && c.open());
        }

        @Override
        public synchronized void release(UUID id) {
            commands.computeIfPresent(id, (k, c) -> DeviceCommand.SENT.equals(c.status())
                    ? new DeviceCommand(c.id(), c.imei(), c.tenantCode(), c.command(), c.purpose(),
                            DeviceCommand.PENDING, c.response(), c.requestedBy(), c.requestedAt(), null, null,
                            c.expiresAt())
                    : c);
        }

        @Override
        public synchronized boolean markSent(UUID id, OffsetDateTime at) {
            DeviceCommand c = commands.get(id);
            if (c == null || !DeviceCommand.PENDING.equals(c.status())) {
                return false;
            }
            commands.put(id, with(c, DeviceCommand.SENT, c.response(), at, c.answeredAt()));
            return true;
        }

        @Override
        public void markAnswered(UUID id, String response, OffsetDateTime at) {
            commands.computeIfPresent(id, (k, c) -> with(c, DeviceCommand.ANSWERED, response, c.sentAt(), at));
        }

        @Override
        public void markFailed(UUID id, String reason, OffsetDateTime at) {
            commands.computeIfPresent(id, (k, c) -> DeviceCommand.PENDING.equals(c.status())
                    || DeviceCommand.SENT.equals(c.status()) ? with(c, DeviceCommand.FAILED, reason, c.sentAt(), at) : c);
        }

        @Override
        public int expire(OffsetDateTime now) {
            int n = 0;
            for (DeviceCommand c : snapshot()) {
                if (DeviceCommand.PENDING.equals(c.status()) && !c.expiresAt().isAfter(now)) {
                    commands.put(c.id(), with(c, DeviceCommand.EXPIRED, null, null, null));
                    n++;
                }
            }
            return n;
        }

        @Override
        public void saveIntensive(IntensiveTracking tracking) {
            intensive.put(tracking.imei(), tracking);
        }

        @Override
        public Optional<IntensiveTracking> intensive(String imei) {
            return Optional.ofNullable(intensive.get(imei));
        }

        @Override
        public List<IntensiveTracking> dueIntensive(OffsetDateTime now) {
            return intensive.values().stream().filter(t -> t.endedAt() == null && !t.until().isAfter(now)).toList();
        }

        @Override
        public synchronized boolean endIntensive(String imei, OffsetDateTime at) {
            IntensiveTracking t = intensive.get(imei);
            if (t == null || t.endedAt() != null) {
                return false;
            }
            intensive.put(imei, new IntensiveTracking(t.imei(), t.tenantCode(), t.startedAt(), t.until(), t.reason(),
                    t.requestedBy(), t.previousParams(), at, null));
            return true;
        }

        @Override
        public synchronized void addPreviousParam(String imei, int paramId, String value) {
            intensive.computeIfPresent(imei, (k, t) -> new IntensiveTracking(t.imei(), t.tenantCode(), t.startedAt(),
                    t.until(), t.reason(), t.requestedBy(),
                    (t.previousParams() == null || t.previousParams().isEmpty() ? "" : t.previousParams() + ";")
                            + paramId + ":" + value, t.endedAt(), t.restoredAt()));
        }

        @Override
        public synchronized void markRestored(String imei, OffsetDateTime at) {
            intensive.computeIfPresent(imei, (k, t) -> t.restoredAt() != null ? t
                    : new IntensiveTracking(t.imei(), t.tenantCode(), t.startedAt(), t.until(), t.reason(),
                            t.requestedBy(), t.previousParams(), t.endedAt(), at));
        }

        @Override
        public List<IntensiveTracking> unrestored() {
            return intensive.values().stream().filter(t -> t.endedAt() != null && t.restoredAt() == null).toList();
        }

        public List<DeviceCommand> all() {
            return snapshot();
        }

        private List<DeviceCommand> snapshot() {
            synchronized (commands) {
                return new ArrayList<>(commands.values());
            }
        }

        private static DeviceCommand with(DeviceCommand c, String status, String response, OffsetDateTime sentAt,
                OffsetDateTime answeredAt) {
            return new DeviceCommand(c.id(), c.imei(), c.tenantCode(), c.command(), c.purpose(), status, response,
                    c.requestedBy(), c.requestedAt(), sentAt != null ? sentAt : c.sentAt(), answeredAt,
                    c.expiresAt());
        }
    }

    /** {@link ProfileStore}. */
    public static final class Profiles implements ProfileStore {
        private final Map<UUID, ConfigProfile> configs = new ConcurrentHashMap<>();
        private final Map<UUID, InputProfile> inputs = new ConcurrentHashMap<>();
        private Devices devices;

        @Override
        public List<ConfigProfile> configProfiles(String tenantCode) {
            return configs.values().stream().filter(p -> p.tenantCode().equals(tenantCode))
                    .sorted(Comparator.comparing(ConfigProfile::name)).toList();
        }

        @Override
        public Optional<ConfigProfile> configProfile(UUID id) {
            return Optional.ofNullable(configs.get(id));
        }

        @Override
        public synchronized void saveConfig(ConfigProfile p) {
            if (configs.values().stream().anyMatch(o -> !o.id().equals(p.id()) && o.tenantCode().equals(p.tenantCode())
                    && o.name().equals(p.name()))) {
                throw new IllegalStateException("a profile with that name already exists in this organization");
            }
            configs.put(p.id(), p);
        }

        @Override
        public boolean deleteConfig(String tenantCode, UUID id) {
            return configs.remove(id) != null;
        }

        @Override
        public List<InputProfile> inputProfiles(String tenantCode) {
            return inputs.values().stream().filter(p -> p.tenantCode().equals(tenantCode))
                    .sorted(Comparator.comparing(InputProfile::name)).toList();
        }

        @Override
        public Optional<InputProfile> inputProfile(UUID id) {
            return Optional.ofNullable(inputs.get(id));
        }

        @Override
        public synchronized void saveInput(InputProfile p) {
            if (inputs.values().stream().anyMatch(o -> !o.id().equals(p.id()) && o.tenantCode().equals(p.tenantCode())
                    && o.name().equals(p.name()))) {
                throw new IllegalStateException("a profile with that name already exists in this organization");
            }
            inputs.put(p.id(), p);
        }

        @Override
        public boolean deleteInput(String tenantCode, UUID id) {
            return inputs.remove(id) != null;
        }

        @Override
        public int devicesUsing(UUID profileId) {
            return devices == null ? 0 : (int) devices.devices.values().stream()
                    .filter(d -> profileId.equals(d.configProfileId()) || profileId.equals(d.inputProfileId())).count();
        }
    }

    /** A fresh set. */
    public record Set(Devices devices, Monitor monitor, Commands commands, Profiles profiles) {
        public static Set create() {
            Profiles profiles = new Profiles();
            return new Set(new Devices(profiles), new Monitor(), new Commands(), profiles);
        }
    }

    static <T> List<T> copy(Collection<T> c) {
        return new ArrayList<>(c);
    }
}
