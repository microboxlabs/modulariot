package com.microboxlabs.miot.teltonika.service;

import com.microboxlabs.miot.teltonika.catalog.DeviceModel;
import com.microboxlabs.miot.teltonika.catalog.ModelCatalog;
import com.microboxlabs.miot.teltonika.command.CommandService;
import com.microboxlabs.miot.teltonika.command.CommandStore;
import com.microboxlabs.miot.teltonika.command.DeviceCommand;
import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.device.DeviceRegistry;
import com.microboxlabs.miot.teltonika.device.DeviceStore;
import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.ingest.RecordSink;
import com.microboxlabs.miot.teltonika.ingest.RecordSink.IngestOutcome;
import com.microboxlabs.miot.teltonika.monitor.MonitorStore;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.monitor.PendingPacket;
import com.microboxlabs.miot.teltonika.protocol.ProtocolException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jboss.logging.Logger;

/**
 * Possession proof. A registered device stays pending until it reports the activation code the
 * installer loaded into it (parameter 2015, read with {@code getparam 2015} over Codec 12). Then it is
 * activated and the packets kept while it was pending are published, so the data of the day of the
 * installation is not lost. Devices that arrive through Traccar cannot report a code: a platform
 * owner approves their claim ({@link #approve}), with the same replay. Blocking; runs on a worker.
 */
public final class ActivationService {

    private static final Logger LOG = Logger.getLogger(ActivationService.class);
    private static final Pattern VALUE = Pattern.compile("Value:\\s*(\\S*)", Pattern.CASE_INSENSITIVE);
    /** A device that answered a wrong code is asked again after this pause. */
    static final Duration RETRY_AFTER = Duration.ofMinutes(10);

    private final DeviceStore devices;
    private final MonitorStore monitor;
    private final CommandStore commandStore;
    private final CommandService commands;
    private final DeviceRegistry registry;
    private final PendingPackets pending;
    private final ModelCatalog catalog;
    private final Clock clock;

    public ActivationService(DeviceStore devices, MonitorStore monitor, CommandStore commandStore,
            CommandService commands, DeviceRegistry registry, RecordSink sink, Clock clock) {
        this(devices, monitor, commandStore, commands, registry, new PendingPackets(sink, null, true),
                ModelCatalog.of(List.of()), clock);
    }

    public ActivationService(DeviceStore devices, MonitorStore monitor, CommandStore commandStore,
            CommandService commands, DeviceRegistry registry, PendingPackets pending, ModelCatalog catalog,
            Clock clock) {
        this.devices = devices;
        this.monitor = monitor;
        this.commandStore = commandStore;
        this.commands = commands;
        this.registry = registry;
        this.pending = pending;
        this.catalog = catalog;
        this.clock = clock;
    }

    /** A pending claim, for the platform's approval queue. */
    public record PendingClaim(String imei, String tenantCode, String model, String brand, String via, String label,
            OffsetDateTime claimedAt, String claimedBy, OffsetDateTime claimExpiresAt, OffsetDateTime lastSeenAt,
            long packetsKept) {
    }

    /** Claims waiting for possession proof, every organization. Devices through Traccar wait for approval. */
    public List<PendingClaim> pendingClaims() {
        return devices.pendingClaims().stream().map(d -> {
            var model = catalog.find(d.model());
            var status = monitor.status(d.imei());
            return new PendingClaim(d.imei(), d.tenantCode(), d.model(), model.map(m -> m.brand()).orElse(null),
                    model.map(m -> m.via()).orElse(DeviceModel.NATIVE), d.label(), d.createdAt(), d.createdBy(),
                    d.claimExpiresAt(), status.map(x -> x.lastSeenAt()).orElse(null),
                    status.map(x -> x.packets()).orElse(0L));
        }).toList();
    }

    /**
     * A platform owner approves a claim of a device that arrives through Traccar: those devices
     * cannot report an activation code back. Native Teltonika devices prove possession themselves.
     */
    public void approve(String imei, String actor) {
        Device d = devices.find(Device.requireId(imei)).filter(Device::pending)
                .orElseThrow(() -> new NoSuchElementException("no pending claim for that device"));
        if (catalog.via(d.model()).equals(DeviceModel.NATIVE)) {
            throw new IllegalStateException("a " + d.model() + " proves possession with its activation code"
                    + " (parameter 2015); it is not approved by hand");
        }
        activate(d, actor);
    }

    /** Asks a connected pending device for its code, unless a check is open or answered recently. */
    public void requestCheck(RegisteredDevice device) {
        if (device.activated()) {
            return;
        }
        OffsetDateTime cutoff = OffsetDateTime.now(clock).minus(RETRY_AFTER);
        boolean recent = commandStore.list(device.imei(), 20).stream()
                .anyMatch(c -> DeviceCommand.ACTIVATION.equals(c.purpose())
                        && (c.open() || c.requestedAt().isAfter(cutoff)));
        if (!recent) {
            commands.requestActivationCheck(device.imei(), device.tenantCode());
        }
    }

    /** The device's answer to {@code getparam 2015}; returns whether it activated the device. */
    public boolean answered(DeviceCommand command, String response) {
        Optional<Device> found = devices.find(command.imei()).filter(Device::pending);
        if (found.isEmpty()) {
            return false;
        }
        Device d = found.get();
        Matcher m = VALUE.matcher(response == null ? "" : response);
        String reported = m.find() ? m.group(1) : "";
        if (!reported.equals(d.activationCode())) {
            LOG.warnf("Activation code does not match: imei=%s (the installer must load the code shown at"
                    + " registration into parameter 2015)", d.imei());
            return false;
        }
        activate(d, "activation");
        return true;
    }

    private void activate(Device d, String actor) {
        OffsetDateTime now = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        devices.update(d.with(d.model(), d.label(), true, now, d.captureUntil(), now, actor));
        registry.invalidate(d.imei());
        LOG.infof("Device activated: imei=%s, tenant=%s, by %s", d.imei(), d.tenantCode(), actor);
        replay(d.imei());
    }

    /**
     * Replays what is still pending for devices that are already active: a replay that failed half
     * way, or packets another pod kept while its registry still had the device as pending.
     * Periodic, one instance at a time.
     */
    public void replayLeftovers() {
        for (String imei : monitor.devicesWithPendingPackets()) {
            if (registry.find(imei).filter(RegisteredDevice::activated).isEmpty()) {
                continue;
            }
            try {
                replay(imei);
            } catch (RuntimeException e) {
                LOG.warnf("Replay of pending packets will be retried: imei=%s, %s", imei, e.getMessage());
            }
        }
    }

    /** Publishes the packets kept while the device was pending, oldest first. */
    int replay(String imei) {
        RegisteredDevice device = registry.find(imei).orElseThrow();
        int published = 0;
        List<Long> done = new ArrayList<>();
        try {
            for (PendingPacket p : monitor.pendingActivation(imei)) {
                try {
                    IngestOutcome o = pending.publish(device, p.entry()).toCompletableFuture().get(30, TimeUnit.SECONDS);
                    published += o.published();
                    done.add(p.id());
                } catch (ProtocolException | IllegalArgumentException e) {
                    LOG.warnf("Pending packet of imei=%s cannot be decoded, left in the log: %s", imei,
                            e.getMessage());
                } catch (Exception e) {
                    throw new IllegalStateException("replay of pending packets failed for imei=" + imei, e);
                }
            }
        } finally {
            // What was published is marked even if a later packet failed; the rest is retried by
            // replayLeftovers (records sent twice are not published twice).
            monitor.markReplayed(imei, done);
        }
        LOG.infof("Replayed packets kept before activation: imei=%s, %d records published", imei, published);
        return published;
    }
}
