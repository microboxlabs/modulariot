package com.microboxlabs.miot.teltonika.traccar;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.teltonika.catalog.ChannelRules;
import com.microboxlabs.miot.teltonika.catalog.ModelCatalog;
import com.microboxlabs.miot.teltonika.device.DeviceRegistry;
import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.ingest.RecordSink;
import com.microboxlabs.miot.teltonika.ingest.RecordSink.IngestOutcome;
import com.microboxlabs.miot.teltonika.ingest.TrackingRecordSink;
import com.microboxlabs.miot.teltonika.monitor.DeviceMonitor;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.monitor.StatusDelta;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.jboss.logging.Logger;

/**
 * Positions of devices of other brands, forwarded by Traccar (the open-source gateway that speaks
 * their protocols). The same rules as the native receiver: only registered, active devices; a pending
 * claim keeps its positions until a platform owner approves it; a position is answered as received
 * only once it is published or durably kept. Blocking; runs on a worker.
 *
 * <p>Traccar knows nothing of organizations: the device's {@code uniqueId} is looked up in the
 * platform's registry, which says whose it is and which asset it reports for.
 */
public final class TraccarIngest {

    private static final Logger LOG = Logger.getLogger(TraccarIngest.class);

    /** What happened to one forwarded position. */
    public record Result(String outcome, String reason) {

        public static final String PUBLISHED = "published";
        public static final String DUPLICATE = "duplicate";
        public static final String KEPT = "kept";
        public static final String PENDING = "pending_activation";
        public static final String UNKNOWN = "unknown_device";
        public static final String WRONG_CHANNEL = "wrong_channel";
    }

    private final DeviceRegistry registry;
    private final RecordSink sink;
    private final DeviceMonitor monitor;
    private final String gpsProvider;
    private final boolean lastKnownPosition;
    private final Duration publishTimeout;
    private final Clock clock;
    private final AtomicLong unknown = new AtomicLong();
    private final AtomicLong wrongChannel = new AtomicLong();
    private final ModelCatalog catalog;

    public TraccarIngest(DeviceRegistry registry, RecordSink sink, DeviceMonitor monitor, String gpsProvider,
            boolean lastKnownPosition, Duration publishTimeout, Clock clock, ModelCatalog catalog) {
        this.catalog = catalog;
        this.registry = registry;
        this.sink = sink;
        this.monitor = monitor;
        this.gpsProvider = gpsProvider;
        this.lastKnownPosition = lastKnownPosition;
        this.publishTimeout = publishTimeout;
        this.clock = clock;
    }

    /**
     * @throws IllegalArgumentException the body is not a Traccar position (400: Traccar must not retry)
     * @throws IllegalStateException    it could not be published nor kept (503: Traccar retries)
     */
    public Result handle(JsonNode body, String remote) {
        TraccarPosition pos = TraccarPosition.parse(body);
        Optional<RegisteredDevice> found = registry.find(pos.uniqueId());
        if (found.isEmpty()) {
            long n = unknown.incrementAndGet();
            if (n == 1 || n % 1000 == 0) {
                LOG.infof("Traccar position of an unregistered device, dropped: uniqueId=%s (%d so far)",
                        pos.uniqueId(), n);
            }
            return new Result(Result.UNKNOWN, null);
        }
        RegisteredDevice device = found.get();
        if (!ChannelRules.traccarAccepts(catalog, device, pos.protocol())) {
            // A native device, or another brand's protocol: not this device's channel. Dropped like
            // an unknown device (Traccar must not retry it).
            long n = wrongChannel.incrementAndGet();
            if (n == 1 || n % 1000 == 0) {
                LOG.warnf("Traccar position for a device of another channel or protocol, dropped: uniqueId=%s,"
                        + " model=%s, protocol=%s (%d so far)", pos.uniqueId(), device.model(), pos.protocol(), n);
            }
            return new Result(Result.WRONG_CHANNEL, null);
        }
        Instant now = clock.instant();
        byte[] raw = body.toString().getBytes(StandardCharsets.UTF_8);
        StatusDelta status = monitor.status(device.imei());
        status.packet(now);
        status.observe(pos.observation());
        if (!device.activated()) {
            monitor.keepDurably(entry(device, now, remote, PacketLogEntry.PENDING_ACTIVATION, "device not activated yet",
                    raw));
            return new Result(Result.PENDING, null);
        }
        IngestOutcome o;
        try {
            o = sink.publish(device, TrackingRecordSink.TRACCAR, List.of(pos.candidate(gpsProvider, lastKnownPosition)))
                    .toCompletableFuture().get(publishTimeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted while publishing", e);
        } catch (Exception e) {
            throw new IllegalStateException("the position could not be published: " + e.getMessage(), e);
        }
        status.outcome(o.published(), o.withoutPosition(), o.outOfTime() + o.unassigned());
        if (o.notPublished() > 0) {
            monitor.keepDurably(entry(device, now, remote, PacketLogEntry.PARTIAL, o.reason(), raw));
            return new Result(Result.KEPT, o.reason());
        }
        if (device.capturing(now)) {
            monitor.keep(entry(device, now, remote, PacketLogEntry.PUBLISHED, null, raw));
        }
        return new Result(o.published() > 0 ? Result.PUBLISHED : Result.DUPLICATE, null);
    }

    private static PacketLogEntry entry(RegisteredDevice d, Instant at, String remote, String outcome, String reason,
            byte[] raw) {
        return new PacketLogEntry(d.imei(), d.tenantCode(), OffsetDateTime.ofInstant(at, ZoneOffset.UTC), remote,
                outcome, reason, null, 1, raw, PacketLogEntry.TRACCAR_JSON);
    }
}
