package com.microboxlabs.miot.teltonika.server;

import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.WIKI_CODEC8E_ONE_RECORD;
import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.WIKI_CODEC8_ONE_RECORD;
import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.WIKI_CODEC8_TWO_RECORDS;
import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.hex;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.EnvelopedMessage;
import com.microboxlabs.miot.core.messaging.IComponentBus;
import com.microboxlabs.miot.core.messaging.IMessagePublisher;
import com.microboxlabs.miot.teltonika.command.CommandDispatcher;
import com.microboxlabs.miot.teltonika.command.CommandService;
import com.microboxlabs.miot.teltonika.command.DeviceCommand;
import com.microboxlabs.miot.teltonika.device.AssetDirectory;
import com.microboxlabs.miot.teltonika.device.CachedDeviceRegistry;
import com.microboxlabs.miot.teltonika.guide.ConnectionGuide;
import com.microboxlabs.miot.teltonika.ingest.DuplicateFilter;
import com.microboxlabs.miot.teltonika.ingest.TrackingRecordSink;
import com.microboxlabs.miot.teltonika.mapping.AvlRecordMapper;
import com.microboxlabs.miot.teltonika.monitor.DeviceMonitor;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.service.ActivationService;
import com.microboxlabs.miot.teltonika.service.DeviceService;
import com.microboxlabs.miot.teltonika.store.ClusterLock;
import com.microboxlabs.miot.teltonika.service.DeviceService.DeviceRequest;
import com.microboxlabs.miot.teltonika.store.InMemoryStores;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder;
import com.microboxlabs.miot.teltonika.tools.Fmb920Emulator;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.vertx.core.Vertx;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Real TCP connections from the FMB920 emulator to the receiver. The broker and the database are
 * replaced by in-memory versions; everything else is the production code path. Covers the
 * acceptance criteria of requerimiento_fmb920.md §9 and the findings of the architects' eval.
 */
class TeltonikaTcpServerTest {

    private static final String WIKI_IMEI = "356307042441013";
    private static final String TENANT = "acme-client-0123456789abcdef0123";
    private static final String TOPIC = "persistent://streamhub/tracking/asset-positions";
    private static final Duration ACK_TIMEOUT = Duration.ofSeconds(2);

    private final List<Published> published = new CopyOnWriteArrayList<>();
    private final List<EnvelopedMessage> bus = new CopyOnWriteArrayList<>();
    private final AtomicBoolean publisherDown = new AtomicBoolean();
    private final InMemoryStores.Set stores = InMemoryStores.Set.create();
    private Vertx vertx;
    private TeltonikaTcpServer server;
    private SimpleMeterRegistry meters;
    private DeviceMonitor monitor;
    private DeviceService devices;
    private DeviceService claims;
    private CommandDispatcher dispatcher;
    private int port;

    record Published(String topic, String key, EnvelopedMessage message) {
    }

    @BeforeEach
    void start() throws Exception {
        start(50, Duration.ofSeconds(1));
    }

    void start(int maxPerIp, Duration handshake) throws Exception {
        start(maxPerIp, handshake, 1);
    }

    void start(int maxPerIp, Duration handshake, int instances) throws Exception {
        vertx = Vertx.vertx();
        meters = new SimpleMeterRegistry();
        var registry = new CachedDeviceRegistry(stores.devices());
        monitor = new DeviceMonitor(stores.monitor(), 1000);
        var commands = new CommandService(stores.commands(), Clock.systemUTC());
        devices = new DeviceService(stores.devices(), stores.monitor(), stores.commands(), commands, registry,
                new ConnectionGuide("localhost", 5027), AssetDirectory.open(),
                new DeviceService.Settings(false, Duration.ofHours(72), Duration.ofDays(7)), Clock.systemUTC());
        claims = new DeviceService(stores.devices(), stores.monitor(), stores.commands(), commands, registry,
                new ConnectionGuide("localhost", 5027), AssetDirectory.open(), DeviceService.Settings.defaults(),
                Clock.systemUTC());
        if (stores.devices().find(WIKI_IMEI).isEmpty()) {
            devices.register(TENANT, new DeviceRequest(WIKI_IMEI, null, null, "TLTK01",
                    OffsetDateTime.parse("2010-01-01T00:00:00Z")), "test");
        }
        registry.reload();
        var sessions = new SessionRegistry();
        var sink = new TrackingRecordSink(new FakePublisher(), new FakeBus(), new AvlRecordMapper("Teltonika"),
                new DuplicateFilter(256, Duration.ofHours(2)), TOPIC, Duration.ofMinutes(5), Duration.ofDays(30),
                Clock.systemUTC());
        var activation = new ActivationService(stores.devices(), stores.monitor(), stores.commands(), commands,
                registry, sink, Clock.systemUTC());
        dispatcher = new CommandDispatcher(stores.commands(), commands, activation, registry, sessions,
                ClusterLock.local(), vertx, Clock.systemUTC());
        int bindPort = instances == 1 ? 0 : freePort();
        var settings = new Receiver.Settings("127.0.0.1", bindPort, Duration.ofSeconds(30), handshake, maxPerIp, 1024,
                instances, Duration.ofSeconds(2), Duration.ofSeconds(2), false, Receiver.Tls.none());
        server = new TeltonikaTcpServer(new Receiver(vertx, settings, registry, sink, monitor,
                new TeltonikaMetrics(meters), sessions, new PublishGate(2000), dispatcher));
        port = server.start().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
    }

    @AfterEach
    void stop() throws Exception {
        server.stop(Duration.ofSeconds(1)).toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        vertx.close().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
    }

    @Test
    void wikiPacketsAreAcknowledgedAndKeptWhenTheyCannotBePublished() throws Exception {
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(1, device.send(hex(WIKI_CODEC8_ONE_RECORD)));
            assertEquals(2, device.send(hex(WIKI_CODEC8_TWO_RECORDS)));
            assertEquals(1, device.send(hex(WIKI_CODEC8E_ONE_RECORD)));
        }
        // The wiki examples are from 2019 and carry position 0/0: not published, kept.
        assertTrue(published.isEmpty());
        monitor.flush();
        assertEquals(3, stores.monitor().packets.stream()
                .filter(p -> PacketLogEntry.PARTIAL.equals(p.outcome())).count());
    }

    @Test
    void wholeTripIsPublishedWithTheOrganizationsClientId() throws Exception {
        var trip = trip(Instant.now().minus(Duration.ofMinutes(10)));
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            for (int i = 0; i < trip.size(); i += 5) {
                assertEquals(5, device.send(AvlPacketEncoder.codec8Extended(trip.subList(i, i + 5))));
            }
        }
        assertEquals(20, published.size());
        Published first = published.getFirst();
        assertEquals(TOPIC, first.topic());
        assertEquals("TLTK01", first.key());
        assertEquals(TENANT, first.message().getClientId(), "tenancy per organization");
        assertEquals(20, bus.size());
        for (Published p : published) {
            assertTrue(p.message().getRequestId().matches("[0-9a-f]{32}"), p.message().getRequestId());
            assertNotNull(p.message().getPayload().getGps());
        }
        assertEquals(1, published.stream().map(p -> p.message().getPayload().getEvents())
                .filter(e -> e != null && "hard_brake".equals(e.getFirst().getEventType())).count());
        monitor.flush();
        var status = stores.monitor().status(WIKI_IMEI).orElseThrow();
        assertEquals(20, status.recordsPublished());
        assertNotNull(status.ignitionOnSeenAt());
        assertNotNull(status.ignitionOffSeenAt());
        assertEquals("0136A24F000000C7", status.lastIbutton());
        assertTrue(devices.installationCheck(TENANT, WIKI_IMEI).items().stream()
                .anyMatch(i -> i.code().equals("ignition") && i.result().name().equals("OK")));
    }

    @Test
    void unregisteredImeiIsRejected() throws Exception {
        try (var device = connect()) {
            assertFalse(device.login("490154203237518"));
            assertTrue(device.isClosedByServer());
        }
        assertEquals(1.0, meters.counter("miot.teltonika.devices.rejected").count());
    }

    @Test
    void connectionWithoutImeiIsClosedAfterTheHandshakeTimeout() throws Exception {
        try (var device = Fmb920Emulator.connect("127.0.0.1", port, Duration.ofSeconds(3))) {
            assertTrue(device.isClosedByServer());
        }
        assertEquals(1.0, meters.counter("miot.teltonika.handshake.timeouts").count());
    }

    @Test
    void connectionsPerAddressAreCapped() throws Exception {
        stop();
        start(2, Duration.ofSeconds(5));
        try (var a = connect(); var b = connect(); var c = connect()) {
            assertTrue(c.isClosedByServer(), "third connection from the same address");
            assertTrue(a.login(WIKI_IMEI));
        }
        assertEquals(1.0, meters.counter("miot.teltonika.connections.ip_limited").count());
    }

    @Test
    void secondSessionOfTheSameImeiReplacesTheFirst() throws Exception {
        try (var first = connect(); var second = connect()) {
            assertTrue(first.login(WIKI_IMEI));
            assertTrue(second.login(WIKI_IMEI));
            assertTrue(first.isClosedByServer());
            byte[] packet = AvlPacketEncoder.codec8Extended(trip(Instant.now().minusSeconds(60)).subList(0, 1));
            assertEquals(1, second.send(packet));
        }
        assertEquals(1.0, meters.counter("miot.teltonika.sessions.replaced").count());
    }

    @Test
    void badCrcIsNotAcknowledgedAndTheConnectionStaysUsable() throws Exception {
        byte[] packet = AvlPacketEncoder.codec8Extended(trip(Instant.now().minusSeconds(60)).subList(0, 1));
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(-1, device.send(AvlPacketEncoder.withBadCrc(packet)));
            assertEquals(1, device.send(packet));
        }
        assertEquals(1, published.size());
        monitor.flush();
        assertTrue(stores.monitor().packets.stream().anyMatch(p -> PacketLogEntry.CRC_ERROR.equals(p.outcome())));
    }

    @Test
    void undecodablePacketIsQuarantinedAndAcknowledgedSoItCannotBlockTheDevice() throws Exception {
        byte[] next = AvlPacketEncoder.codec8Extended(trip(Instant.now().minusSeconds(60)).subList(0, 1));
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(1, device.send(AvlPacketEncoder.unsupportedCodec()), "declared count acknowledged");
            assertEquals(1, device.send(next), "the queue moves on");
        }
        assertEquals(1, published.size());
        monitor.flush();
        assertEquals(1, stores.monitor().packets.stream()
                .filter(p -> PacketLogEntry.QUARANTINED.equals(p.outcome())).count());
        assertEquals(1, stores.monitor().status(WIKI_IMEI).orElseThrow().quarantinedPackets());
    }

    @Test
    void recordsWithAWrongClockAreKeptNotPublished() throws Exception {
        var future = trip(Instant.now().plus(Duration.ofDays(400))).subList(0, 2);
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(2, device.send(AvlPacketEncoder.codec8Extended(future)));
        }
        assertTrue(published.isEmpty());
        monitor.flush();
        assertEquals(2, stores.monitor().status(WIKI_IMEI).orElseThrow().recordsOutOfTime());
        assertTrue(stores.monitor().packets.stream().anyMatch(p -> p.reason() != null
                && p.reason().contains("out_of_time=2")));
    }

    @Test
    void packetArrivingInPiecesIsDecoded() throws Exception {
        byte[] packet = AvlPacketEncoder.codec8Extended(trip(Instant.now().minusSeconds(300)).subList(0, 5));
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(5, device.sendFragmented(packet, 7));
        }
        assertEquals(5, published.size());
    }

    @Test
    void failedPublishGetsNoAckAndTheResentPacketIsPublishedOnce() throws Exception {
        byte[] packet = AvlPacketEncoder.codec8Extended(trip(Instant.now().minusSeconds(300)).subList(0, 5));
        publisherDown.set(true);
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(-1, device.send(packet));
            assertTrue(device.isClosedByServer());
        }
        publisherDown.set(false);
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(5, device.send(packet));
            assertEquals(5, device.send(packet), "a resend after a lost ack is acknowledged again");
        }
        assertEquals(5, published.size(), "each record published once");
        assertEquals(5.0, meters.counter("miot.teltonika.records.duplicates").count());
    }

    @Test
    void recordsKeepTheAssetOfTheirTimeAfterAReassignment() throws Exception {
        Instant t0 = Instant.now().minus(Duration.ofMinutes(10)).truncatedTo(ChronoUnit.SECONDS);
        devices.reassign(TENANT, WIKI_IMEI, "NEW001",
                OffsetDateTime.ofInstant(t0.plusSeconds(150), ZoneOffset.UTC), "test");
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(10, device.send(AvlPacketEncoder.codec8Extended(trip(t0).subList(0, 10))));
        }
        assertEquals(5, published.stream().filter(p -> "TLTK01".equals(p.key())).count());
        assertEquals(5, published.stream().filter(p -> "NEW001".equals(p.key())).count());
    }

    @Test
    void deactivatedDeviceIsDisconnectedOnItsNextPacket() throws Exception {
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            devices.deactivate(TENANT, WIKI_IMEI, "test");
            device.sendWithoutWaiting(AvlPacketEncoder.codec8Extended(
                    trip(Instant.now().minusSeconds(60)).subList(0, 1)));
            assertTrue(device.isClosedByServer());
        }
        assertTrue(published.isEmpty());
    }

    @Test
    void commandIsDeliveredAndTheAnswerSaved() throws Exception {
        var command = devices.command(TENANT, WIKI_IMEI, "getgps", "ana");
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(1, device.send(AvlPacketEncoder.codec8Extended(
                    trip(Instant.now().minusSeconds(60)).subList(0, 1))));
            tick();
            String received = device.readCommand();
            assertEquals("getgps", received);
            device.answer(Fmb920Emulator.simulatedAnswer(received));
            await(() -> DeviceCommand.ANSWERED.equals(stores.commands().find(command.id()).orElseThrow().status()));
        }
        var saved = stores.commands().find(command.id()).orElseThrow();
        assertTrue(saved.response().startsWith("GPS:1"));
        assertNotNull(saved.sentAt());
    }

    @Test
    void unansweredCommandFails() throws Exception {
        var command = devices.command(TENANT, WIKI_IMEI, "getinfo", "ana");
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            tick();
            assertEquals("getinfo", device.readCommand());
            await(() -> DeviceCommand.FAILED.equals(stores.commands().find(command.id()).orElseThrow().status()));
        }
    }

    @Test
    void stopClosesTheSessionsAndRefusesNewConnections() throws Exception {
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            server.stop(Duration.ofSeconds(1)).toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
            assertTrue(device.isClosedByServer());
        }
        assertFalse(server.isListening());
    }

    @Test
    void pendingDeviceIsKeptUntilItProvesPossessionThenItsPacketsArePublished() throws Exception {
        String imei = "352093086403655";
        var claim = claims.register(TENANT, new DeviceRequest(imei, null, null, "NEWT01", null), "ana");
        String code = claim.device().activationCode();
        var trip = trip(Instant.now().minus(Duration.ofMinutes(10)));
        try (var device = connect()) {
            assertTrue(device.login(imei), "a pending device may connect");
            assertEquals(5, device.send(AvlPacketEncoder.codec8Extended(trip.subList(0, 5))));
            assertTrue(published.isEmpty(), "not published before activation");
            assertEquals(1, stores.monitor().pendingActivation(imei).size(), "kept durably before the ack");

            Fmb920Emulator.PARAMS.put("2015", "000000");
            tick();
            assertEquals("getparam 2015", device.readCommand());
            device.answer(Fmb920Emulator.simulatedAnswer("getparam 2015"));
            await(() -> stores.commands().all().stream().anyMatch(c -> DeviceCommand.ANSWERED.equals(c.status())));
            assertTrue(published.isEmpty(), "a wrong code does not activate");

            Fmb920Emulator.PARAMS.put("2015", code);
            stores.commands().all().forEach(c -> stores.commands().markFailed(c.id(), "test", OffsetDateTime.now()));
            claims.connection(TENANT, imei);
            new CommandService(stores.commands(), Clock.systemUTC()).requestActivationCheck(imei, TENANT);
            tick();
            assertEquals("getparam 2015", device.readCommand());
            device.answer(Fmb920Emulator.simulatedAnswer("getparam 2015"));
            await(() -> published.size() == 5);
            assertEquals(5, device.send(AvlPacketEncoder.codec8Extended(trip.subList(5, 10))), "now published live");
        } finally {
            Fmb920Emulator.PARAMS.remove("2015");
        }
        assertEquals(10, published.size());
        assertEquals("active", claims.get(TENANT, imei).device().state());
        assertTrue(stores.monitor().pendingActivation(imei).isEmpty(), "replayed");
    }

    @Test
    void nothingIsAcknowledgedIfItCouldNotBeWrittenDurably() throws Exception {
        stores.monitor().failWrites = true;
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(-1, device.send(AvlPacketEncoder.unsupportedCodec()), "quarantine not written: no ack");
            assertTrue(device.isClosedByServer());
        }
        stores.monitor().failWrites = false;
        try (var device = connect()) {
            assertTrue(device.login(WIKI_IMEI));
            assertEquals(1, device.send(AvlPacketEncoder.unsupportedCodec()), "written now: acknowledged");
        }
    }

    @Test
    void severalListenerInstancesShareThePort() throws Exception {
        stop();
        start(50, Duration.ofSeconds(5), 3);
        byte[] packet = AvlPacketEncoder.codec8Extended(trip(Instant.now().minusSeconds(60)).subList(0, 1));
        for (int i = 0; i < 6; i++) {
            try (var device = connect()) {
                assertTrue(device.login(WIKI_IMEI));
                assertEquals(1, device.send(packet));
            }
        }
        assertEquals(1, published.size(), "same record six times: published once");
    }

    private static int freePort() throws java.io.IOException {
        try (var socket = new java.net.ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    private void tick() throws Exception {
        vertx.executeBlocking(() -> {
            dispatcher.tick();
            return null;
        }, false).toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
    }

    private Fmb920Emulator connect() throws Exception {
        return Fmb920Emulator.connect("127.0.0.1", port, ACK_TIMEOUT);
    }

    private static List<AvlPacketEncoder.Record> trip(Instant start) {
        return Fmb920Emulator.santiagoTrip(start.truncatedTo(ChronoUnit.SECONDS), Duration.ofSeconds(30));
    }

    private static void await(BooleanSupplier condition) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5_000;
        while (!condition.getAsBoolean()) {
            if (System.currentTimeMillis() > deadline) {
                throw new AssertionError("condition not met within 5 s");
            }
            Thread.sleep(20);
        }
    }

    private final class FakePublisher implements IMessagePublisher {

        @Override
        public <T> CompletionStage<Void> publish(String topic, T message) {
            return publish(topic, null, message);
        }

        @Override
        public <T> CompletionStage<Void> publish(String topic, String key, T message) {
            if (publisherDown.get()) {
                return CompletableFuture.failedFuture(new IllegalStateException("broker down"));
            }
            published.add(new Published(topic, key, (EnvelopedMessage) message));
            return CompletableFuture.completedFuture(null);
        }
    }

    private final class FakeBus implements IComponentBus {

        @Override
        public <T> void publish(String channel, T event) {
            assertEquals(TrackingRecordSink.TRACKING_BUS_CHANNEL, channel);
            bus.add((EnvelopedMessage) event);
        }

        @Override
        public <T> void subscribe(String channel, Class<T> type, Consumer<T> handler) {
            throw new UnsupportedOperationException();
        }
    }
}
