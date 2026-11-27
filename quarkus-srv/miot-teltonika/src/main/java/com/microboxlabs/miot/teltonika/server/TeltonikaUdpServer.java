package com.microboxlabs.miot.teltonika.server;

import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.protocol.CodecParser;
import com.microboxlabs.miot.teltonika.protocol.ProtocolException;
import com.microboxlabs.miot.teltonika.protocol.UdpChannel;
import com.microboxlabs.miot.teltonika.protocol.UdpChannel.Datagram;
import io.vertx.core.Context;
import io.vertx.core.Future;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.datagram.DatagramPacket;
import io.vertx.core.datagram.DatagramSocket;
import io.vertx.core.datagram.DatagramSocketOptions;
import java.time.Duration;
import java.util.Optional;
import org.jboss.logging.Logger;

/**
 * UDP listener for Teltonika devices configured with protocol UDP (parameter 2006 = 1). Each
 * datagram carries the IMEI, so there is no session: the device is looked up per datagram and
 * acknowledged with the same rules as TCP (published or durably kept first). Unknown, inactive or
 * malformed datagrams get no answer. Commands are not sent over UDP.
 */
public final class TeltonikaUdpServer {

    private static final Logger LOG = Logger.getLogger(TeltonikaUdpServer.class);

    private final Receiver rx;
    private final int port;
    private final SampledLog sampled = new SampledLog(LOG, 5, Duration.ofMinutes(1));
    private final PacketIngest ingest;
    private DatagramSocket socket;
    private Context context;

    public TeltonikaUdpServer(Receiver rx, int port) {
        this.rx = rx;
        this.port = port;
        this.ingest = new PacketIngest(rx, sampled);
    }

    /** Completes with the bound port. */
    public Future<Integer> start() {
        context = rx.vertx().getOrCreateContext();
        Future<Integer> started = Future.future(p -> context.runOnContext(v -> {
            socket = rx.vertx().createDatagramSocket(new DatagramSocketOptions().setReceiveBufferSize(4 * 1024 * 1024));
            socket.handler(this::onDatagram);
            socket.listen(port, rx.settings().host()).onSuccess(s -> {
                int bound = s.localAddress().port();
                LOG.infof("Teltonika UDP receiver listening on %s:%d", rx.settings().host(), bound);
                p.complete(bound);
            }).onFailure(p::fail);
        }));
        return started;
    }

    public Future<Void> stop() {
        return socket == null ? Future.succeededFuture() : socket.close();
    }

    private void onDatagram(DatagramPacket packet) {
        byte[] raw = packet.data().getBytes();
        String remote = String.valueOf(packet.sender());
        Datagram d;
        try {
            d = UdpChannel.parse(raw);
        } catch (ProtocolException e) {
            rx.metrics().protocolError();
            sampled.warn("udp:" + packet.sender().host(), "Malformed UDP datagram from " + remote + ": " + e.getMessage());
            return;
        }
        Optional<RegisteredDevice> found = rx.registry().find(d.imei());
        if (found.isEmpty()) {
            rx.metrics().deviceRejected();
            sampled.warn("rejected:" + d.imei(), "UDP datagram of unregistered or inactive device: imei=" + d.imei());
            return;
        }
        RegisteredDevice device = found.get();
        ingest.handle(context, device, raw, PacketLogEntry.TELTONIKA_UDP, remote, () -> CodecParser.parse(d.avlData()),
                        d.declaredCount())
                .onSuccess(count -> socket.send(Buffer.buffer(UdpChannel.ack(d.packetId(), d.avlPacketId(), count)),
                        packet.sender().port(), packet.sender().host()))
                .onFailure(e -> LOG.errorf(e, "UDP packet not acknowledged, the device sends it again: imei=%s",
                        device.imei()));
    }
}
