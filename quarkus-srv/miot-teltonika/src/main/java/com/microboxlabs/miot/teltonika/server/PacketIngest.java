package com.microboxlabs.miot.teltonika.server;

import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.ingest.RecordSink.IngestOutcome;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.monitor.StatusDelta;
import com.microboxlabs.miot.teltonika.protocol.AvlPacket;
import com.microboxlabs.miot.teltonika.protocol.AvlRecord;
import io.vertx.core.Context;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * The handling of one Teltonika packet that arrives without a session (UDP datagram, MQTT message),
 * with the same rules as a TCP session: nothing is acknowledged unless it is published or durably
 * written. Completes with the record count to acknowledge; a failure means "do not acknowledge"
 * (the device, or the broker, sends it again).
 */
final class PacketIngest {

    private final Receiver rx;
    private final SampledLog sampled;

    PacketIngest(Receiver rx, SampledLog sampled) {
        this.rx = rx;
        this.sampled = sampled;
    }

    /** One packet of the packet's own protocol, kept raw in {@code format} when needed. Call on {@code context}. */
    Future<Integer> handle(Context context, RegisteredDevice device, byte[] raw, String format, String remote,
            Supplier<AvlPacket> decode, int declaredCount) {
        Instant now = Instant.now();
        StatusDelta status = rx.monitor().status(device.imei());
        rx.metrics().packetReceived();
        status.packet(now);
        AvlPacket packet;
        try {
            packet = decode.get();
        } catch (RuntimeException e) { // ProtocolException and anything else the decoder throws
            // Anything that cannot be decoded is quarantined and acknowledged: a malformed message
            // must not stay unacknowledged and block the device's (or the broker's) queue.
            rx.metrics().protocolError();
            rx.metrics().quarantined();
            status.quarantined();
            sampled.warn("quarantine:" + device.imei(), "Packet quarantined: imei=" + device.imei() + ", reason="
                    + e.getMessage());
            return keep(entry(device, now, remote, PacketLogEntry.QUARANTINED, e.getMessage(), null, declaredCount,
                    raw, format), declaredCount);
        }
        for (AvlRecord r : packet.records()) {
            status.record(r);
            rx.metrics().recordLag(Duration.between(r.timestamp(), now));
        }
        if (!device.activated()) {
            return keep(entry(device, now, remote, PacketLogEntry.PENDING_ACTIVATION, "device not activated yet",
                    packet.codecId(), packet.recordCount(), raw, format), packet.recordCount());
        }
        return publish(context, device, packet, status, now, raw, format, remote);
    }

    private Future<Integer> keep(PacketLogEntry e, int count) {
        return rx.vertx().executeBlocking(() -> {
            rx.monitor().keepDurably(e);
            return count;
        }, false);
    }

    private Future<Integer> publish(Context context, RegisteredDevice device, AvlPacket packet, StatusDelta status,
            Instant receivedAt, byte[] raw, String format, String remote) {
        int count = packet.recordCount();
        long deadline = System.nanoTime() + rx.settings().publishTimeout().toNanos();
        Promise<Integer> done = Promise.promise();
        long[] waitTimer = {-1};
        PublishGate.Ticket ticket = rx.gate().acquire(count, context, granted -> {
            if (waitTimer[0] >= 0) {
                rx.vertx().cancelTimer(waitTimer[0]);
            }
            if (!granted) {
                rx.metrics().publishFailed();
                done.fail(new IllegalStateException("waited too long for the publish bound"));
                return;
            }
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) {
                rx.gate().release(count);
                done.fail(new IllegalStateException("publish deadline passed while waiting"));
                return;
            }
            long start = System.nanoTime();
            rx.vertx().<CompletionStage<IngestOutcome>>executeBlocking(() -> rx.sink().publish(device, packet.records()),
                            false)
                    .compose(stage -> Future.fromCompletionStage(stage.toCompletableFuture()
                            .orTimeout(remaining, TimeUnit.NANOSECONDS), context))
                    .compose(outcome -> {
                        status.outcome(outcome.published(), outcome.withoutPosition(),
                                outcome.outOfTime() + outcome.unassigned());
                        rx.metrics().published(outcome.published(), outcome.notPublished(), outcome.duplicates());
                        if (outcome.notPublished() > 0) {
                            return keep(entry(device, receivedAt, remote, PacketLogEntry.PARTIAL, outcome.reason(),
                                    packet.codecId(), count, raw, format), count);
                        }
                        if (device.capturing(receivedAt)) {
                            rx.monitor().keep(entry(device, receivedAt, remote, PacketLogEntry.PUBLISHED, null,
                                    packet.codecId(), count, raw, format));
                        }
                        return Future.succeededFuture(count);
                    })
                    .onComplete(ar -> {
                        rx.gate().release(count);
                        rx.metrics().publishTook(Duration.ofNanos(System.nanoTime() - start));
                        if (ar.failed()) {
                            rx.metrics().publishFailed();
                            done.fail(ar.cause());
                        } else {
                            done.complete(ar.result());
                        }
                    });
        });
        long wait = TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime());
        if (wait > 0) {
            waitTimer[0] = rx.vertx().setTimer(wait, t -> rx.gate().cancel(ticket));
        }
        return done.future();
    }

    static PacketLogEntry entry(RegisteredDevice device, Instant at, String remote, String outcome, String reason,
            Integer codec, Integer count, byte[] raw, String format) {
        return new PacketLogEntry(device.imei(), device.tenantCode(), OffsetDateTime.ofInstant(at, ZoneOffset.UTC),
                remote, outcome, reason, codec, count, raw, format);
    }
}
