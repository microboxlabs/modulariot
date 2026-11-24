package com.microboxlabs.miot.teltonika.service;

import com.microboxlabs.miot.teltonika.catalog.DeviceModel;
import com.microboxlabs.miot.teltonika.catalog.ModelCatalog;
import com.microboxlabs.miot.teltonika.command.CommandService;
import com.microboxlabs.miot.teltonika.command.CommandStore;
import com.microboxlabs.miot.teltonika.command.DeviceCommand;
import com.microboxlabs.miot.teltonika.command.IntensiveTracking;
import com.microboxlabs.miot.teltonika.device.AssetDirectory;
import com.microboxlabs.miot.teltonika.device.Assignment;
import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.device.DeviceRegistry;
import com.microboxlabs.miot.teltonika.device.DeviceStore;
import com.microboxlabs.miot.teltonika.guide.ConnectionGuide;
import com.microboxlabs.miot.teltonika.monitor.DeviceStatus;
import com.microboxlabs.miot.teltonika.monitor.MonitorStore;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.profile.ConfigProfile;
import com.microboxlabs.miot.teltonika.profile.ProfileStore;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

/**
 * An organization's devices: register, edit, assign to an asset, deactivate, and everything the
 * installer and the operator read about one device. Blocking. Every call takes the organization's
 * tenant code; a device of another organization is reported as not found.
 *
 * <p>Registration is a claim: the device stays pending until it proves possession (see
 * {@link ActivationService}). An IMEI another organization holds, or claimed and has not let expire,
 * is answered as not available, without saying whether it exists.
 */
public final class DeviceService {

    public static final Duration MAX_CAPTURE = Duration.ofHours(2);
    private static final HexFormat HEX = HexFormat.of().withUpperCase();
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Registration rules. */
    public record Settings(boolean activationRequired, Duration claimTtl, Duration backfill) {

        public static Settings defaults() {
            return new Settings(true, Duration.ofHours(72), Duration.ofDays(7));
        }
    }

    private final DeviceStore devices;
    private final MonitorStore monitor;
    private final CommandStore commandStore;
    private final CommandService commands;
    private final DeviceRegistry registry;
    private final ConnectionGuide guide;
    private final AssetDirectory assets;
    private final Settings settings;
    private final Clock clock;
    private final ModelCatalog catalog;
    private final ProfileStore profiles;

    /** Without catalog nor profiles: the FMB920 family only (tests of the native receiver). */
    public DeviceService(DeviceStore devices, MonitorStore monitor, CommandStore commandStore,
            CommandService commands, DeviceRegistry registry, ConnectionGuide guide, AssetDirectory assets,
            Settings settings, Clock clock) {
        this(devices, monitor, commandStore, commands, registry, guide, assets, settings, clock, NATIVE_920, null);
    }

    public DeviceService(DeviceStore devices, MonitorStore monitor, CommandStore commandStore,
            CommandService commands, DeviceRegistry registry, ConnectionGuide guide, AssetDirectory assets,
            Settings settings, Clock clock, ModelCatalog catalog, ProfileStore profiles) {
        this.devices = devices;
        this.monitor = monitor;
        this.commandStore = commandStore;
        this.commands = commands;
        this.registry = registry;
        this.guide = guide;
        this.assets = assets;
        this.settings = settings;
        this.clock = clock;
        this.catalog = catalog;
        this.profiles = profiles;
    }

    static final ModelCatalog NATIVE_920 = ModelCatalog.of(java.util.stream.Stream.of("FMB920", "FMC920", "FMM920")
            .map(c -> new DeviceModel(c, "Teltonika", c, "teltonika", DeviceModel.NATIVE, null, "fmb9xx", true, null))
            .toList());

    /** Registration request. {@code assignedFrom} null means "covering what the device buffered". */
    public record DeviceRequest(String imei, String model, String label, String assetId, OffsetDateTime assignedFrom) {
    }

    /**
     * A device with its current asset and a health summary.
     *
     * @param state          {@code pending} (possession not proved), {@code active} or {@code inactive}
     * @param activationCode shown only while pending, to load into the device (parameter 2015); null for
     *                       devices through Traccar, whose claim a platform owner approves
     * @param via            {@code native} or {@code traccar}
     */
    public record DeviceView(String imei, String model, String brand, String via, String label, String state,
            String activationCode, OffsetDateTime claimExpiresAt, String assetId, OffsetDateTime lastSeenAt,
            OffsetDateTime lastRecordAt, boolean connectedRecently, OffsetDateTime captureUntil,
            UUID configProfileId, UUID inputProfileId, OffsetDateTime createdAt, String createdBy) {
    }

    /** Detail: the view plus every assignment. */
    public record DeviceDetail(DeviceView device, List<Assignment> assignments, IntensiveTracking intensive) {
    }

    /** One kept packet, hex encoded. */
    public record PacketView(OffsetDateTime receivedAt, String outcome, String reason, Integer codecId,
            Integer recordCount, String remoteAddress, String hex) {
    }

    public List<DeviceView> list(String tenant, Boolean active) {
        return devices.list(tenant, active).stream().map(d -> view(d, devices.assignments(d.imei()))).toList();
    }

    public DeviceDetail get(String tenant, String imei) {
        Device d = owned(tenant, imei);
        List<Assignment> assignments = devices.assignments(d.imei());
        return new DeviceDetail(view(d, assignments), assignments,
                commandStore.intensive(d.imei()).filter(IntensiveTracking::active).orElse(null));
    }

    public DeviceDetail register(String tenant, DeviceRequest req, String actor) {
        DeviceModel m = catalog.require(req.model());
        String imei = m.isNative() ? Device.requireImei(req.imei()) : Device.requireId(req.imei());
        String model = m.code();
        String asset = requireAsset(req.assetId());
        OffsetDateTime now = now();
        Optional<Device> existing = devices.find(imei);
        if (existing.isPresent()) {
            Device e = existing.get();
            if (e.tenantCode().equals(tenant)) {
                throw new IllegalStateException("the device is already registered in this organization");
            }
            if (!e.claimExpired(clock.instant())) {
                throw new NoSuchElementException("the device is not available for registration");
            }
            devices.deleteExpiredClaim(imei);
        }
        if (!assets.mayAssign(tenant, asset)) {
            throw new IllegalArgumentException("the asset " + asset + " cannot be assigned by this organization");
        }
        boolean activated = !settings.activationRequired();
        devices.register(new Device(imei, tenant, model, trim(req.label()), true,
                activated || !m.isNative() ? null : activationCode(), activated ? now : null,
                activated ? null : now.plus(settings.claimTtl()), null, now, actor, now, actor),
                asset, req.assignedFrom() == null ? now.minus(settings.backfill()) : req.assignedFrom(), actor);
        registry.invalidate(imei);
        return get(tenant, imei);
    }

    public DeviceDetail update(String tenant, String imei, String model, String label, String actor) {
        Device d = owned(tenant, imei);
        String newModel = d.model();
        if (model != null) {
            DeviceModel m = catalog.require(model);
            if (!m.via().equals(catalog.via(d.model()))) {
                throw new IllegalArgumentException("the model must arrive the same way (" + catalog.via(d.model())
                        + "); register the device again for another brand");
            }
            newModel = m.code();
        }
        devices.update(d.with(newModel,
                label == null ? d.label() : trim(label), d.active(), d.activatedAt(), d.captureUntil(), now(), actor));
        registry.invalidate(d.imei());
        return get(tenant, d.imei());
    }

    /**
     * The device reports for another asset from {@code from} (null: now). Records keep the asset of
     * their time. The installation sightings restart, since the device is now in another vehicle.
     */
    public DeviceDetail reassign(String tenant, String imei, String assetId, OffsetDateTime from, String actor) {
        Device d = owned(tenant, imei);
        requireActive(d);
        String asset = requireAsset(assetId);
        if (!assets.mayAssign(tenant, asset)) {
            throw new IllegalArgumentException("the asset " + asset + " cannot be assigned by this organization");
        }
        OffsetDateTime at = from == null ? now() : from;
        devices.assignments(d.imei()).stream().filter(Assignment::open).findFirst().ifPresent(open -> {
            if (!at.isAfter(open.validFrom())) {
                throw new IllegalArgumentException("the new assignment must start after " + open.validFrom());
            }
        });
        devices.reassign(d.imei(), asset, at, actor);
        monitor.resetSightings(d.imei());
        registry.invalidate(d.imei());
        return get(tenant, d.imei());
    }

    /** Refused on its next packet or connection; its open assignment closes now. */
    public DeviceDetail deactivate(String tenant, String imei, String actor) {
        Device d = owned(tenant, imei);
        OffsetDateTime now = now();
        devices.update(d.with(d.model(), d.label(), false, d.activatedAt(), null, now, actor));
        devices.closeAssignment(d.imei(), now);
        registry.invalidate(d.imei());
        return get(tenant, d.imei());
    }

    /** Keeps every packet of the device for {@code duration} (installation, support). */
    public DeviceDetail capture(String tenant, String imei, Duration duration, String actor) {
        Device d = owned(tenant, imei);
        requireActive(d);
        if (duration.compareTo(Duration.ofMinutes(1)) < 0 || duration.compareTo(MAX_CAPTURE) > 0) {
            throw new IllegalArgumentException("capture must last between 1 minute and " + MAX_CAPTURE.toMinutes() + " min");
        }
        devices.update(d.with(d.model(), d.label(), true, d.activatedAt(), now().plus(duration), now(), actor));
        registry.invalidate(d.imei());
        return get(tenant, d.imei());
    }

    public ConnectionGuide.Guide connection(String tenant, String imei) {
        Device d = owned(tenant, imei);
        DeviceModel m = catalog.find(d.model()).orElse(null);
        if (m != null && !m.isNative()) {
            return guide.traccarGuide(m);
        }
        return guide.guide(d.model(), d.pending() ? d.activationCode() : null, configProfile(d));
    }

    /**
     * Assigns the configuration and input profiles (null removes one). With {@code apply}, the
     * configuration profile is also sent to the device (native devices only).
     */
    public DeviceDetail setProfiles(String tenant, String imei, UUID configProfileId, UUID inputProfileId,
            boolean apply, String actor) {
        Device d = owned(tenant, imei);
        requireActive(d);
        if (profiles == null) {
            throw new IllegalStateException("profiles are not available");
        }
        ConfigProfile config = configProfileId == null ? null : profiles.configProfile(configProfileId)
                .filter(p -> p.tenantCode().equals(tenant))
                .orElseThrow(() -> new IllegalArgumentException("configuration profile not found"));
        if (inputProfileId != null && profiles.inputProfile(inputProfileId)
                .filter(p -> p.tenantCode().equals(tenant)).isEmpty()) {
            throw new IllegalArgumentException("input profile not found");
        }
        if (apply && config != null) {
            requireNative(d);
        }
        devices.update(d.withProfiles(configProfileId, inputProfileId, now(), actor));
        registry.invalidate(d.imei());
        if (apply && config != null) {
            commands.applyProfile(d, config.params(), actor);
        }
        return get(tenant, d.imei());
    }

    /** The models the platform receives, for the registration form. */
    public List<DeviceModel> models() {
        return catalog.all();
    }

    private ConfigProfile configProfile(Device d) {
        return profiles == null || d.configProfileId() == null ? null
                : profiles.configProfile(d.configProfileId()).orElse(null);
    }

    private void requireNative(Device d) {
        if (!catalog.via(d.model()).equals(DeviceModel.NATIVE)) {
            throw new IllegalStateException("commands are only available for devices connected natively; "
                    + d.model() + " arrives through Traccar");
        }
    }

    public Optional<DeviceStatus> health(String tenant, String imei) {
        return monitor.status(owned(tenant, imei).imei());
    }

    public InstallationCheck.Report installationCheck(String tenant, String imei) {
        Device d = owned(tenant, imei);
        return InstallationCheck.evaluate(d, monitor.status(d.imei()).orElse(null), clock.instant());
    }

    public List<PacketView> packets(String tenant, String imei, Integer limit) {
        Device d = owned(tenant, imei);
        int n = limit == null ? 50 : Math.min(Math.max(limit, 1), 500);
        return monitor.packets(d.imei(), n).stream().map(DeviceService::packet).toList();
    }

    public DeviceCommand command(String tenant, String imei, String command, String actor) {
        Device d = owned(tenant, imei);
        requireNative(d);
        return commands.request(d, command, actor);
    }

    public List<DeviceCommand> commands(String tenant, String imei, Integer limit) {
        return commands.list(owned(tenant, imei).imei(), limit == null ? 50 : limit);
    }

    public IntensiveTracking startIntensive(String tenant, String imei, Duration duration, String reason, String actor) {
        Device d = owned(tenant, imei);
        requireNative(d);
        return commands.startIntensive(d, duration, reason, actor);
    }

    public void endIntensive(String tenant, String imei, String actor) {
        Device d = owned(tenant, imei);
        if (!commands.endIntensive(d.imei(), d.tenantCode(), actor)) {
            throw new IllegalStateException("the device is not in intensive tracking");
        }
    }

    private Device owned(String tenant, String imei) {
        String id = Device.requireId(imei);
        return devices.find(id).filter(d -> d.tenantCode().equals(tenant))
                .orElseThrow(() -> new NoSuchElementException("device not found"));
    }

    private DeviceView view(Device d, List<Assignment> assignments) {
        String asset = assignments.stream().filter(Assignment::open).map(Assignment::assetId).findFirst().orElse(null);
        DeviceStatus s = monitor.status(d.imei()).orElse(null);
        OffsetDateTime seen = s == null ? null : s.lastSeenAt();
        boolean recent = seen != null && seen.toInstant().isAfter(clock.instant().minus(InstallationCheck.REPORTING));
        String state = !d.active() ? "inactive" : d.pending() ? "pending" : "active";
        var m = catalog.find(d.model());
        return new DeviceView(d.imei(), d.model(), m.map(DeviceModel::brand).orElse(null),
                m.map(DeviceModel::via).orElse(DeviceModel.NATIVE), d.label(), state,
                d.pending() ? d.activationCode() : null, d.pending() ? d.claimExpiresAt() : null, asset, seen,
                s == null ? null : s.lastRecordAt(), recent, d.captureUntil(), d.configProfileId(),
                d.inputProfileId(), d.createdAt(), d.createdBy());
    }

    private static PacketView packet(PacketLogEntry e) {
        return new PacketView(e.receivedAt(), e.outcome(), e.reason(), e.codecId(), e.recordCount(), e.remoteAddress(),
                HEX.formatHex(e.packet()));
    }

    private static void requireActive(Device d) {
        if (!d.active()) {
            throw new IllegalStateException("the device is inactive");
        }
    }

    /** License plate: letters and digits, 4 to 12 after removing spaces and dashes. */
    static String requireAsset(String assetId) {
        if (assetId == null || assetId.isBlank()) {
            throw new IllegalArgumentException("assetId is required");
        }
        String a = assetId.trim().toUpperCase(Locale.ROOT).replace("-", "").replace(" ", "");
        if (!a.matches("^[A-Z0-9]{4,12}$")) {
            throw new IllegalArgumentException("assetId must be a license plate (4 to 12 letters and digits)");
        }
        return a;
    }

    private static String activationCode() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }
}
