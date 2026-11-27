package com.microboxlabs.miot.teltonika.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.EnvelopedMessage;
import cl.streamhub.gps.model.Event;
import com.microboxlabs.miot.core.messaging.IComponentBus;
import com.microboxlabs.miot.core.messaging.IMessagePublisher;
import com.microboxlabs.miot.teltonika.command.CommandDispatcher;
import com.microboxlabs.miot.teltonika.command.CommandService;
import com.microboxlabs.miot.teltonika.command.DeviceCommand;
import com.microboxlabs.miot.teltonika.device.CachedDeviceRegistry;
import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.ingest.DuplicateFilter;
import com.microboxlabs.miot.teltonika.ingest.TrackingRecordSink;
import com.microboxlabs.miot.teltonika.inputs.InputMapping;
import com.microboxlabs.miot.teltonika.inputs.InputProfile;
import com.microboxlabs.miot.teltonika.mapping.AvlRecordMapper;
import com.microboxlabs.miot.teltonika.mapping.TeltonikaIo;
import com.microboxlabs.miot.teltonika.monitor.DeviceMonitor;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.protocol.UdpChannel;
import com.microboxlabs.miot.teltonika.service.ActivationService;
import com.microboxlabs.miot.teltonika.store.ClusterLock;
import com.microboxlabs.miot.teltonika.store.InMemoryStores;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder.Record;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.netty.handler.codec.mqtt.MqttQoS;
import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.mqtt.MqttEndpoint;
import io.vertx.mqtt.MqttServer;
import io.vertx.mqtt.MqttServerOptions;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Teltonika packets without a TCP session: real UDP datagrams, and MQTT messages delivered by a
 * stand-in broker (Vert.x MQTT server). Same rules as TCP: acknowledged (UDP ack, MQTT PUBACK) only
 * once published or kept; inputs mapped by the organization become named events.
 */
class SessionlessChannelsTest {

    private static final String IMEI = "352093086403655";
    private static final String TENANT = "acme";
    private static final OffsetDateTime FROM = OffsetDateTime.parse("2020-01-01T00:00:00Z");

    private final InMemoryStores.Set stores = InMemoryStores.Set.create();
    private final List<EnvelopedMessage> published = new CopyOnWriteArrayList<>();
    private final AtomicBoolean brokerDown = new AtomicBoolean();
    private Vertx vertx;
    private Receiver receiver;
    private DeviceMonitor monitor;
    private CachedDeviceRegistry registry;
    private CommandDispatcher dispatcher;

    @BeforeEach
    void start() {
        vertx = Vertx.vertx();
        var inputs = new InputProfile(UUID.randomUUID(), TENANT, "Furgón", null,
                List.of(new InputMapping("din2", "door", "Puerta trasera", true, null, true, true)), null, null, null,
                null);
        stores.profiles().saveInput(inputs);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        stores.devices().register(new Device(IMEI, TENANT, "FMB920", null, true, null, now, null, null, now, "t", now,
                "t", null, inputs.id()), "TLTK02", FROM, "t");
        registry = new CachedDeviceRegistry(stores.devices());
        registry.reload();
        monitor = new DeviceMonitor(stores.monitor(), 1000);
        var commands = new CommandService(stores.commands(), Clock.systemUTC());
        var sink = new TrackingRecordSink(new Publisher(), new Bus(), new AvlRecordMapper("Teltonika"),
                new DuplicateFilter(256, Duration.ofHours(2)), "topic", Duration.ofMinutes(5), Duration.ofDays(30),
                Clock.systemUTC());
        var activation = new ActivationService(stores.devices(), stores.monitor(), stores.commands(), commands,
                registry, sink, Clock.systemUTC());
        var sessions = new SessionRegistry();
        dispatcher = new CommandDispatcher(stores.commands(), commands, activation, registry, sessions,
                ClusterLock.local(), vertx, Clock.systemUTC());
        var settings = new Receiver.Settings("127.0.0.1", 0, Duration.ofSeconds(30), Duration.ofSeconds(5), 50, 128, 1,
                Duration.ofSeconds(2), Duration.ofSeconds(2), false, Receiver.Tls.none());
        receiver = new Receiver(vertx, settings, registry, sink, monitor, new TeltonikaMetrics(new SimpleMeterRegistry()),
                sessions, new PublishGate(2000), dispatcher);
    }

    @AfterEach
    void stop() throws Exception {
        vertx.close().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
    }

    // ---------------------------------------------------------------- UDP

    @Test
    void udpDatagramsAreAcknowledgedAfterPublishingAndInputsBecomeEvents() throws Exception {
        var udp = new TeltonikaUdpServer(receiver, 0);
        int port = udp.start().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        Instant t = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        try (var socket = new DatagramSocket()) {
            socket.setSoTimeout(2000);
            byte[] closed = data(new Record(t.minusSeconds(20)).position(-33.45, -70.66, 570, 0, 9, 0)
                    .io1(TeltonikaIo.DIGITAL_INPUT_2, 0));
            byte[] open = data(new Record(t.minusSeconds(10)).position(-33.45, -70.66, 570, 0, 9, 0).event(2)
                    .io1(TeltonikaIo.DIGITAL_INPUT_2, 1));
            assertEquals("00050001010101", hex(send(socket, port, UdpChannel.encode(1, 1, IMEI, closed))));
            assertEquals("00050002010201", hex(send(socket, port, UdpChannel.encode(2, 2, IMEI, open))));

            assertEquals(2, published.size());
            List<Event> events = published.get(1).getPayload().getEvents();
            assertEquals("door_open", events.getFirst().getEventType());
            assertEquals("Puerta trasera (din2)", events.getFirst().getDescription());

            // Unknown device: no answer.
            byte[] unknown = UdpChannel.encode(3, 3, "356307042441013", closed);
            assertEquals(null, sendOrNull(socket, port, unknown));

            // Broker down: no answer, the device resends.
            brokerDown.set(true);
            byte[] later = data(new Record(t).position(-33.45, -70.66, 570, 0, 9, 0));
            assertEquals(null, sendOrNull(socket, port, UdpChannel.encode(4, 4, IMEI, later)));
            brokerDown.set(false);
            assertEquals("00050004010401", hex(send(socket, port, UdpChannel.encode(4, 4, IMEI, later))));
        }
        udp.stop();
    }

    @Test
    void aPendingUdpDeviceIsKeptWithItsFormatForTheReplay() throws Exception {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String pending = "356307042441013";
        stores.devices().register(new Device(pending, TENANT, "FMB920", null, true, "123456", null,
                now.plusHours(72), null, now, "t", now, "t"), "TLTK03", FROM, "t");
        registry.invalidate(pending);
        var udp = new TeltonikaUdpServer(receiver, 0);
        int port = udp.start().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        try (var socket = new DatagramSocket()) {
            socket.setSoTimeout(2000);
            byte[] d = UdpChannel.encode(9, 9, pending, data(new Record(Instant.now().truncatedTo(ChronoUnit.SECONDS))
                    .position(-33.45, -70.66, 570, 0, 9, 0)));
            assertEquals("00050009010901", hex(send(socket, port, d)));
        }
        assertTrue(published.isEmpty());
        PacketLogEntry kept = stores.monitor().packets.getFirst();
        assertEquals(PacketLogEntry.PENDING_ACTIVATION, kept.outcome());
        assertEquals(PacketLogEntry.TELTONIKA_UDP, kept.format());
        udp.stop();
    }

    // ---------------------------------------------------------------- MQTT

    @Test
    void mqttMessagesArePublishedThenAcknowledgedAndCommandsGoToTheCommandsTopic() throws Exception {
        var broker = new Broker();
        int port = broker.start();
        var mqtt = new MqttReceiver(receiver, settings(port));
        mqtt.start().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        await(() -> broker.endpoint.get() != null && broker.subscribed.get());

        String record = "{\"state\":{\"reported\":{\"ts\":" + Instant.now().minusSeconds(5).toEpochMilli()
                + ",\"pr\":0,\"latlng\":\"-33.45,-70.66\",\"alt\":570,\"ang\":0,\"sat\":9,\"sp\":0,\"evt\":0,"
                + "\"239\":1,\"66\":12600}}}";
        int id = broker.deliver(IMEI + "/data", record);
        await(() -> broker.acks.contains(id));
        assertEquals(1, published.size());
        assertTrue(published.getFirst().getPayload().getSensors().getEngineStatus());

        // A command for the device goes out as {"CMD": ...}; its answer arrives on the data topic.
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        var command = new DeviceCommand(UUID.randomUUID(), IMEI, TENANT, "getinfo", DeviceCommand.MANUAL,
                DeviceCommand.PENDING, null, "t", now, null, null, now.plusHours(1));
        stores.commands().insert(command);
        vertx.executeBlocking(() -> {
            dispatcher.tick();
            return null;
        }).toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        await(() -> !broker.commands.isEmpty());
        assertEquals(IMEI + "/commands", broker.commands.getFirst()[0]);
        assertEquals("{\"CMD\":\"getinfo\"}", broker.commands.getFirst()[1]);
        broker.deliver(IMEI + "/data", "{\"RSP\":\"RTC:2026/11/16 12:00 Init:2026/11/16 8:00\"}");
        await(() -> DeviceCommand.ANSWERED.equals(stores.commands().list(IMEI, 5).getFirst().status()));
        assertTrue(stores.commands().list(IMEI, 5).getFirst().response().startsWith("RTC:"));

        mqtt.stop();
        broker.stop();
    }

    @Test
    void aMessageThatCannotBePublishedIsNotAcknowledged() throws Exception {
        var broker = new Broker();
        int port = broker.start();
        var mqtt = new MqttReceiver(receiver, settings(port));
        mqtt.start().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        await(() -> broker.subscribed.get());

        brokerDown.set(true);
        int id = broker.deliver(IMEI + "/data", "{\"state\":{\"reported\":{\"ts\":"
                + Instant.now().toEpochMilli() + ",\"latlng\":\"-33.45,-70.66\"}}}");
        await(() -> broker.disconnects.get() > 0);
        assertFalse(broker.acks.contains(id), "not acknowledged: the broker delivers it again on reconnect");

        // Unknown devices and malformed topics are acknowledged and dropped (they would loop forever).
        brokerDown.set(false);
        await(() -> broker.subscribed.get() && broker.endpoint.get().isConnected());
        int unknown = broker.deliver("356307042441013/data", "{\"state\":{\"reported\":{\"ts\":1}}}");
        await(() -> broker.acks.contains(unknown));
        mqtt.stop();
        broker.stop();
    }

    private static MqttReceiver.Settings settings(int port) {
        return new MqttReceiver.Settings("127.0.0.1", port, false, null, null, null, "miot-test", null, null,
                "+/data", "%imei%/commands", Duration.ofMillis(200), Duration.ofMinutes(15));
    }

    /** A broker stand-in: delivers what the test asks to the subscriber and records PUBACKs and commands. */
    private final class Broker {
        final AtomicReference<MqttEndpoint> endpoint = new AtomicReference<>();
        final AtomicBoolean subscribed = new AtomicBoolean();
        final List<Integer> acks = new CopyOnWriteArrayList<>();
        final List<String[]> commands = new CopyOnWriteArrayList<>();
        final java.util.concurrent.atomic.AtomicInteger disconnects = new java.util.concurrent.atomic.AtomicInteger();
        MqttServer server;

        int start() throws Exception {
            server = MqttServer.create(vertx, new MqttServerOptions().setPort(0).setHost("127.0.0.1"));
            server.endpointHandler(ep -> {
                subscribed.set(false);
                ep.subscribeHandler(sub -> {
                    ep.subscribeAcknowledge(sub.messageId(), sub.topicSubscriptions().stream()
                            .map(s -> s.qualityOfService()).toList());
                    subscribed.set(true);
                });
                ep.publishAcknowledgeHandler(acks::add);
                ep.publishHandler(m -> {
                    commands.add(new String[] {m.topicName(), m.payload().toString(StandardCharsets.UTF_8)});
                    if (m.qosLevel() == MqttQoS.AT_LEAST_ONCE) {
                        ep.publishAcknowledge(m.messageId());
                    }
                });
                ep.disconnectHandler(v -> disconnects.incrementAndGet());
                ep.closeHandler(v -> disconnects.incrementAndGet());
                ep.accept(false);
                endpoint.set(ep);
            });
            return server.listen().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS).actualPort();
        }

        int deliver(String topic, String payload) throws Exception {
            return endpoint.get().publish(topic, Buffer.buffer(payload), MqttQoS.AT_LEAST_ONCE, false, false)
                    .toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        }

        void stop() {
            server.close();
        }
    }

    // ---------------------------------------------------------------- helpers

    private static byte[] data(Record r) {
        return AvlPacketEncoder.dataField(List.of(r));
    }

    private static byte[] send(DatagramSocket socket, int port, byte[] datagram) throws Exception {
        byte[] answer = sendOrNull(socket, port, datagram);
        if (answer == null) {
            throw new AssertionError("no UDP acknowledgment");
        }
        return answer;
    }

    private static byte[] sendOrNull(DatagramSocket socket, int port, byte[] datagram) throws Exception {
        socket.send(new DatagramPacket(datagram, datagram.length, InetAddress.getLoopbackAddress(), port));
        byte[] buf = new byte[64];
        var in = new DatagramPacket(buf, buf.length);
        try {
            socket.receive(in);
        } catch (SocketTimeoutException e) {
            return null;
        }
        return Arrays.copyOf(buf, in.getLength());
    }

    private static String hex(byte[] b) {
        return java.util.HexFormat.of().withUpperCase().formatHex(b);
    }

    private static void await(BooleanSupplier condition) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!condition.getAsBoolean()) {
            if (System.nanoTime() > deadline) {
                throw new AssertionError("condition not met within 5 s");
            }
            Thread.sleep(20);
        }
    }

    private final class Publisher implements IMessagePublisher {
        @Override
        public <T> CompletionStage<Void> publish(String topic, T message) {
            return publish(topic, null, message);
        }

        @Override
        public <T> CompletionStage<Void> publish(String topic, String key, T message) {
            if (brokerDown.get()) {
                return CompletableFuture.failedFuture(new IllegalStateException("broker down"));
            }
            published.add((EnvelopedMessage) message);
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class Bus implements IComponentBus {
        @Override
        public <T> void publish(String channel, T event) {
        }

        @Override
        public <T> void subscribe(String channel, Class<T> type, Consumer<T> handler) {
        }
    }
}
