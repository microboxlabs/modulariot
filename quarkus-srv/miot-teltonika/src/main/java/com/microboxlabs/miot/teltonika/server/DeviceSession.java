package com.microboxlabs.miot.teltonika.server;

import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.ingest.RecordSink.IngestOutcome;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.monitor.StatusDelta;
import com.microboxlabs.miot.teltonika.protocol.AvlPacket;
import com.microboxlabs.miot.teltonika.protocol.AvlRecord;
import com.microboxlabs.miot.teltonika.protocol.Codec12;
import com.microboxlabs.miot.teltonika.protocol.CodecParser;
import com.microboxlabs.miot.teltonika.protocol.ProtocolException;
import com.microboxlabs.miot.teltonika.protocol.TcpFrameDecoder;
import com.microboxlabs.miot.teltonika.protocol.TcpFrameDecoder.DataFrame;
import com.microboxlabs.miot.teltonika.protocol.TcpFrameDecoder.Frame;
import com.microboxlabs.miot.teltonika.protocol.TcpFrameDecoder.ImeiFrame;
import io.vertx.core.Context;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.net.NetSocket;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import org.jboss.logging.Logger;

/**
 * One device connection. Runs on the connection's event loop, one frame at a time:
 *
 * <ol>
 *   <li>IMEI within the handshake timeout: {@code 01} if the device is registered and active (also
 *       while its activation is pending), {@code 00} and close if not. A second session of the same
 *       IMEI replaces the first.
 *   <li>AVL packet. Nothing is acknowledged unless it is either published or durably written:
 *       <ul>
 *         <li>bad CRC: no answer, the device sends it again;
 *         <li>valid CRC but not decodable: written to the packet log (quarantine), then acknowledged
 *             with the declared count, so it cannot block the device's queue;
 *         <li>device pending activation: written to the packet log, then acknowledged; published
 *             when the device proves possession;
 *         <li>otherwise: waits its turn for the global publish bound, records are published off the
 *             event loop, records that could not be published are written to the packet log, and
 *             only then the count is answered. Any failure, or the publish deadline passing, closes
 *             without answer and the device resends.
 *       </ul>
 *   <li>Codec 12: the device's answer to the command this session sent.
 * </ol>
 *
 * <p>While a packet is in progress the socket is paused: packets are acknowledged in order and a slow
 * pipeline pushes back on the device through TCP.
 */
public final class DeviceSession implements CommandLink {

    private static final Logger LOG = Logger.getLogger(DeviceSession.class);
    private static final HexFormat HEX = HexFormat.of().withUpperCase();
    private static final byte ACCEPT = 0x01;
    private static final byte REJECT = 0x00;

    private final NetSocket socket;
    private final Context context;
    private final Receiver rx;
    private final SampledLog sampled;
    private final String remote;
    private final TcpFrameDecoder decoder = new TcpFrameDecoder();
    private final Runnable onClose;

    private RegisteredDevice device;
    private StatusDelta status;
    private long handshakeTimer = -1;
    private boolean busy;
    private boolean closed;
    private PendingCommand pendingCommand;

    private record PendingCommand(UUID id, long timer) {
    }

    DeviceSession(NetSocket socket, Context context, Receiver rx, SampledLog sampled, Runnable onClose) {
        this.socket = socket;
        this.context = context;
        this.rx = rx;
        this.sampled = sampled;
        this.onClose = onClose;
        this.remote = String.valueOf(socket.remoteAddress());
    }

    void start() {
        rx.metrics().connectionOpened();
        socket.handler(this::onBytes);
        socket.closeHandler(v -> onClosed());
        socket.exceptionHandler(e -> LOG.debugf(e, "Connection error: imei=%s", imei()));
        handshakeTimer = rx.vertx().setTimer(rx.settings().handshakeTimeout().toMillis(), id -> {
            if (device == null && !closed) {
                rx.metrics().handshakeTimeout();
                sampled.warn("handshake:" + host(), "No IMEI within the handshake timeout, closing: " + remote);
                close();
            }
        });
    }

    /** IMEI of the device, once identified. */
    public String imei() {
        return device == null ? "-" : device.imei();
    }

    @Override
    public String remoteAddress() {
        return remote;
    }

    /**
     * Sends a command the dispatcher already claimed, if the session is idle (no packet in progress,
     * no command waiting). Called from any thread; completes with whether it was written.
     */
    @Override
    public Future<Boolean> offerCommand(UUID id, String command) {
        Promise<Boolean> sent = Promise.promise();
        context.runOnContext(v -> {
            if (closed || busy || device == null || pendingCommand != null) {
                sent.complete(false);
                return;
            }
            byte[] packet;
            try {
                packet = Codec12.encodeCommand(command);
            } catch (IllegalArgumentException e) {
                sent.fail(e);
                return;
            }
            long timer = rx.vertx().setTimer(rx.settings().commandTimeout().toMillis(), t -> commandTimedOut(id));
            pendingCommand = new PendingCommand(id, timer);
            socket.write(Buffer.buffer(packet));
            rx.metrics().commandSent();
            LOG.infof("Command sent: imei=%s, id=%s, command=%s", imei(), id, command);
            sent.complete(true);
        });
        return sent.future();
    }

    /** Closes the session; the device reconnects. */
    @Override
    public void close() {
        context.runOnContext(v -> {
            if (!closed) {
                closed = true;
                socket.close();
            }
        });
    }

    /** Stops reading new packets; the one in progress still finishes. Used when draining. */
    void pauseReading() {
        context.runOnContext(v -> socket.pause());
    }

    private void onBytes(Buffer bytes) {
        try {
            decoder.append(bytes.getBytes());
        } catch (ProtocolException e) {
            fail(e);
            return;
        }
        drain();
    }

    private void drain() {
        while (!busy && !closed) {
            Frame frame;
            try {
                frame = decoder.next();
            } catch (ProtocolException e) {
                fail(e);
                return;
            }
            if (frame == null) {
                return;
            }
            switch (frame) {
                case ImeiFrame imeiFrame -> identify(imeiFrame.imei());
                case DataFrame dataFrame -> receive(dataFrame);
            }
        }
    }

    private void identify(String imei) {
        rx.vertx().cancelTimer(handshakeTimer);
        Optional<RegisteredDevice> found = rx.registry().find(imei);
        if (found.isEmpty()) {
            rx.metrics().deviceRejected();
            sampled.warn("rejected:" + imei, "Rejected unregistered or inactive device: imei=" + imei + ", from " + remote);
            socket.end(Buffer.buffer(new byte[] {REJECT}));
            closed = true;
            return;
        }
        device = found.get();
        status = rx.monitor().status(imei);
        status.connected(remote, Instant.now());
        rx.sessions().register(imei, this).ifPresent(previous -> {
            rx.metrics().sessionReplaced();
            LOG.warnf("Second session for imei=%s from %s; closing the previous one from %s", imei, remote,
                    previous.remoteAddress());
            previous.close();
        });
        rx.metrics().deviceAccepted();
        LOG.infof("Device connected: imei=%s, tenant=%s%s, from %s", imei, device.tenantCode(),
                device.activated() ? "" : " (pending activation)", remote);
        socket.write(Buffer.buffer(new byte[] {ACCEPT}));
    }

    private void receive(DataFrame frame) {
        Instant now = Instant.now();
        Optional<RegisteredDevice> current = rx.registry().find(device.imei());
        if (current.isEmpty()) {
            LOG.infof("Device deactivated, closing: imei=%s", device.imei());
            close();
            return;
        }
        device = current.get();
        rx.metrics().packetReceived();
        status.packet(now);
        logPacket(frame.rawPacket());
        if (!frame.crcValid()) {
            rx.metrics().crcError();
            status.crcError();
            rx.monitor().keep(entry(frame, now, PacketLogEntry.CRC_ERROR, "crc mismatch", null, null));
            sampled.warn("crc:" + device.imei(), "CRC mismatch, packet not acknowledged: imei=" + device.imei());
            return;
        }
        byte[] data = frame.dataField();
        if (Codec12.isCodec12(data)) {
            commandResponse(frame, now);
            return;
        }
        AvlPacket packet;
        try {
            packet = CodecParser.parse(data);
        } catch (ProtocolException e) {
            quarantine(frame, now, e.getMessage());
            return;
        }
        for (AvlRecord r : packet.records()) {
            status.record(r);
            rx.metrics().recordLag(Duration.between(r.timestamp(), now));
        }
        if (!device.activated()) {
            writeThenAck(entry(frame, now, PacketLogEntry.PENDING_ACTIVATION, "device not activated yet",
                    packet.codecId(), packet.recordCount()), packet.recordCount());
            return;
        }
        publish(frame, packet, now);
    }

    /** Valid CRC but not decodable: written, then acknowledged with the count the device declared. */
    private void quarantine(DataFrame frame, Instant now, String reason) {
        rx.metrics().protocolError();
        rx.metrics().quarantined();
        status.quarantined();
        int declared = frame.dataField().length > 1 ? frame.dataField()[1] & 0xFF : 0;
        int codec = frame.dataField().length > 0 ? frame.dataField()[0] & 0xFF : -1;
        sampled.warn("quarantine:" + device.imei(), "Packet quarantined: imei=" + device.imei() + ", reason=" + reason);
        writeThenAck(entry(frame, now, PacketLogEntry.QUARANTINED, reason, codec, declared), declared);
    }

    /** Writes the packet to the log off the event loop and acknowledges only if that worked. */
    private void writeThenAck(PacketLogEntry entry, int count) {
        busy = true;
        socket.pause();
        rx.vertx().executeBlocking(() -> {
            rx.monitor().keepDurably(entry);
            return null;
        }, false).onComplete(ar -> afterWork(ar.failed() ? ar.cause() : null, count));
    }

    private void publish(DataFrame frame, AvlPacket packet, Instant receivedAt) {
        busy = true;
        socket.pause();
        int count = packet.recordCount();
        long deadline = System.nanoTime() + rx.settings().publishTimeout().toNanos();
        long[] waitTimer = {-1};
        PublishGate.Ticket ticket = rx.gate().acquire(count, context, granted -> {
            if (waitTimer[0] >= 0) {
                rx.vertx().cancelTimer(waitTimer[0]);
            }
            if (!granted) {
                rx.metrics().publishFailed();
                afterWork(new IllegalStateException("waited too long for the publish bound"), count);
                return;
            }
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) {
                rx.gate().release(count);
                afterWork(new IllegalStateException("publish deadline passed while waiting"), count);
                return;
            }
            publishGranted(frame, packet, receivedAt, remaining);
        });
        long wait = TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime());
        if (wait > 0) {
            waitTimer[0] = rx.vertx().setTimer(wait, t -> rx.gate().cancel(ticket));
        }
    }

    private void publishGranted(DataFrame frame, AvlPacket packet, Instant receivedAt, long remainingNanos) {
        int count = packet.recordCount();
        long start = System.nanoTime();
        RegisteredDevice target = device;
        rx.vertx().<CompletionStage<IngestOutcome>>executeBlocking(() -> rx.sink().publish(target, packet.records()),
                        false)
                .compose(stage -> Future.fromCompletionStage(stage.toCompletableFuture()
                        .orTimeout(remainingNanos, TimeUnit.NANOSECONDS), context))
                .compose(outcome -> {
                    // Counted even if the device leaves now: the records were published.
                    status.outcome(outcome.published(), outcome.withoutPosition(),
                            outcome.outOfTime() + outcome.unassigned());
                    rx.metrics().published(outcome.published(), outcome.notPublished(), outcome.duplicates());
                    if (outcome.notPublished() > 0) {
                        PacketLogEntry e = entry(frame, receivedAt, PacketLogEntry.PARTIAL, outcome.reason(),
                                packet.codecId(), count);
                        return rx.vertx().<Void>executeBlocking(() -> {
                            rx.monitor().keepDurably(e);
                            return null;
                        }, false);
                    }
                    if (target.capturing(receivedAt)) {
                        rx.monitor().keep(entry(frame, receivedAt, PacketLogEntry.PUBLISHED, null, packet.codecId(),
                                count));
                    }
                    return Future.<Void>succeededFuture();
                })
                .onComplete(ar -> {
                    rx.gate().release(count);
                    rx.metrics().publishTook(Duration.ofNanos(System.nanoTime() - start));
                    if (ar.failed()) {
                        rx.metrics().publishFailed();
                    }
                    afterWork(ar.failed() ? ar.cause() : null, count);
                });
    }

    /** Ends the packet in progress: acknowledge and read on, or close without answer. */
    private void afterWork(Throwable failure, int count) {
        busy = false;
        if (closed) {
            return;
        }
        if (failure != null) {
            LOG.errorf(failure, "Packet not acknowledged, closing so the device sends again: imei=%s", imei());
            close();
            return;
        }
        socket.write(Buffer.buffer().appendInt(count));
        socket.resume();
        drain();
    }

    private void commandResponse(DataFrame frame, Instant now) {
        String text;
        try {
            text = Codec12.decodeResponse(frame.dataField());
        } catch (ProtocolException e) {
            rx.metrics().protocolError();
            rx.monitor().keep(entry(frame, now, PacketLogEntry.QUARANTINED, e.getMessage(), Codec12.CODEC_ID, null));
            return;
        }
        rx.monitor().keep(entry(frame, now, PacketLogEntry.COMMAND_RESPONSE, null, Codec12.CODEC_ID, 1));
        PendingCommand pending = pendingCommand;
        pendingCommand = null;
        if (pending == null) {
            LOG.infof("Unrequested command response: imei=%s, response=%s", imei(), text);
            return;
        }
        rx.vertx().cancelTimer(pending.timer());
        rx.metrics().commandAnswered();
        LOG.infof("Command answered: imei=%s, id=%s, response=%s", imei(), pending.id(), text);
        rx.commands().answered(pending.id(), text);
    }

    private void commandTimedOut(UUID id) {
        if (pendingCommand != null && pendingCommand.id().equals(id)) {
            pendingCommand = null;
            rx.commands().failed(id, "no response within " + rx.settings().commandTimeout().toSeconds() + " s");
        }
    }

    private PacketLogEntry entry(DataFrame frame, Instant at, String outcome, String reason, Integer codec,
            Integer count) {
        return new PacketLogEntry(device.imei(), device.tenantCode(), OffsetDateTime.ofInstant(at, ZoneOffset.UTC),
                remote, outcome, reason, codec, count, frame.rawPacket());
    }

    private void logPacket(byte[] raw) {
        if (rx.settings().logRawPackets()) {
            LOG.infof("Packet imei=%s: %s", imei(), HEX.formatHex(raw));
        } else if (LOG.isDebugEnabled()) {
            LOG.debugf("Packet imei=%s: %s", imei(), HEX.formatHex(raw));
        }
    }

    private void fail(ProtocolException e) {
        rx.metrics().protocolError();
        sampled.warn("protocol:" + host(), "Protocol error, closing connection: imei=" + imei() + ", from " + remote
                + ": " + e.getMessage());
        closed = true;
        socket.close();
    }

    private void onClosed() {
        closed = true;
        rx.vertx().cancelTimer(handshakeTimer);
        if (pendingCommand != null) {
            rx.vertx().cancelTimer(pendingCommand.timer());
            rx.commands().failed(pendingCommand.id(), "connection closed before the response");
            pendingCommand = null;
        }
        if (device != null) {
            rx.sessions().unregister(device.imei(), this);
        }
        rx.metrics().connectionClosed();
        onClose.run();
        LOG.debugf("Connection closed: %s, imei=%s", remote, imei());
    }

    private String host() {
        return socket.remoteAddress() == null ? "?" : socket.remoteAddress().host();
    }
}
