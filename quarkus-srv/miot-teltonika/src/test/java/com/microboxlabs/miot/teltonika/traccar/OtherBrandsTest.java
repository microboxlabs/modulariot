package com.microboxlabs.miot.teltonika.traccar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.EnvelopedMessage;
import cl.streamhub.gps.model.Event;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.messaging.IComponentBus;
import com.microboxlabs.miot.core.messaging.IMessagePublisher;
import com.microboxlabs.miot.teltonika.api.TraccarForwardResource;
import com.microboxlabs.miot.teltonika.catalog.DeviceModel;
import com.microboxlabs.miot.teltonika.catalog.ModelCatalog;
import com.microboxlabs.miot.teltonika.command.CommandService;
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
import com.microboxlabs.miot.teltonika.service.DeviceService.DeviceRequest;
import com.microboxlabs.miot.teltonika.service.PendingPackets;
import com.microboxlabs.miot.teltonika.service.ProfileService;
import com.microboxlabs.miot.teltonika.service.ProfileService.ConfigRequest;
import com.microboxlabs.miot.teltonika.service.ProfileService.InputRequest;
import com.microboxlabs.miot.teltonika.service.ProfileService.MappingRequest;
import com.microboxlabs.miot.teltonika.store.InMemoryStores;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;

/**
 * Other brands through Traccar, end to end inside the module: registration from the catalog, the
 * forward endpoint with its key, positions kept while the claim is pending, platform approval with
 * replay, input profiles applied to Traccar inputs, and configuration profiles on native devices.
 */
class OtherBrandsTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String ACME = "acme";
    private static final String GT06_ID = "868120201234567";
    private static final String H02_ID = "4209950057";
    private static final ModelCatalog CATALOG = ModelCatalog.of(List.of(
            new DeviceModel("FMB920", "Teltonika", "FMB920", "teltonika", DeviceModel.NATIVE, null, "fmb9xx", true, null),
            new DeviceModel("GT06N", "Concox / Jimi", "GT06N", "gt06", DeviceModel.TRACCAR, 5023, null, false, null),
            new DeviceModel("ST-901", "Sinotrack", "ST-901", "h02", DeviceModel.TRACCAR, 5013, null, false, null)));

    private final InMemoryStores.Set stores = InMemoryStores.Set.create();
    private final CachedDeviceRegistry registry = new CachedDeviceRegistry(stores.devices());
    private final DeviceMonitor monitor = new DeviceMonitor(stores.monitor(), 1000);
    private final List<EnvelopedMessage> published = new CopyOnWriteArrayList<>();
    private final AtomicBoolean brokerDown = new AtomicBoolean();
    private final TrackingRecordSink sink = new TrackingRecordSink(new Publisher(), new Bus(),
            new AvlRecordMapper("Teltonika"), new DuplicateFilter(256, Duration.ofHours(2)), "topic",
            Duration.ofMinutes(5), Duration.ofDays(30), Clock.systemUTC());
    private final CommandService commands = new CommandService(stores.commands(), Clock.systemUTC());
    private final DeviceService devices = new DeviceService(stores.devices(), stores.monitor(), stores.commands(),
            commands, registry, new ConnectionGuide("devices.example.com", 5027, "gw.example.com"),
            AssetDirectory.open(), DeviceService.Settings.defaults(), Clock.systemUTC(), CATALOG, stores.profiles());
    private final ActivationService activation = new ActivationService(stores.devices(), stores.monitor(),
            stores.commands(), commands, registry, new PendingPackets(sink, "Traccar", true), CATALOG,
            Clock.systemUTC());
    private final TraccarIngest ingest = new TraccarIngest(registry, sink, monitor, "Traccar", true,
            Duration.ofSeconds(2), Clock.systemUTC(), CATALOG);
    private final ProfileService profiles = new ProfileService(stores.profiles(), registry::reload, Clock.systemUTC());

    @Test
    void aTraccarDeviceIsHeldUntilAPlatformOwnerApprovesItThenItsPositionsArePublished() throws Exception {
        var detail = devices.register(ACME, new DeviceRequest(GT06_ID, "gt06n", "Camión 7", "ABCD12",
                OffsetDateTime.now(ZoneOffset.UTC).minusDays(1)), "ana");
        assertEquals("pending", detail.device().state());
        assertEquals("traccar", detail.device().via());
        assertNull(detail.device().activationCode(), "no code: it cannot report one back");
        var guide = devices.connection(ACME, GT06_ID);
        assertEquals("gw.example.com", guide.host());
        assertEquals(5023, guide.port());

        var r = ingest.handle(position(GT06_ID, Instant.now().minusSeconds(30), "{\"ignition\":true}"), "traccar");
        assertEquals(TraccarIngest.Result.PENDING, r.outcome());
        assertTrue(published.isEmpty());
        assertEquals(PacketLogEntry.TRACCAR_JSON, stores.monitor().packets.getFirst().format());

        assertEquals(1, activation.pendingClaims().size());
        assertEquals("traccar", activation.pendingClaims().getFirst().via());
        activation.approve(GT06_ID, "owner@microboxlabs.com");

        assertEquals(1, published.size(), "the position kept while pending is published");
        assertEquals("ABCD12", published.getFirst().getPayload().getAssetId());
        assertEquals("active", devices.get(ACME, GT06_ID).device().state());
        assertEquals(PacketLogEntry.PUBLISHED, ingest.handle(position(GT06_ID, Instant.now(), "{}"), "traccar")
                .outcome());
        assertEquals(2, published.size());
    }

    @Test
    void aReplayThatFailsIsRetriedAndOnlyWhatWasPublishedIsMarked() throws Exception {
        devices.register(ACME, new DeviceRequest(GT06_ID, "GT06N", null, "ABCD12",
                OffsetDateTime.now(ZoneOffset.UTC).minusDays(1)), "ana");
        ingest.handle(position(GT06_ID, Instant.now().minusSeconds(60), "{}"), "traccar");
        assertEquals(1, stores.monitor().pendingActivation(GT06_ID).size());

        brokerDown.set(true);
        assertThrows(IllegalStateException.class, () -> activation.approve(GT06_ID, "owner"),
                "activated, but the replay could not publish");
        assertEquals("active", devices.get(ACME, GT06_ID).device().state());
        assertEquals(1, stores.monitor().pendingActivation(GT06_ID).size(), "not marked: nothing was published");

        brokerDown.set(false);
        activation.replayLeftovers();
        assertEquals(1, published.size(), "the periodic retry publishes it");
        assertTrue(stores.monitor().pendingActivation(GT06_ID).isEmpty());
        activation.replayLeftovers();
        assertEquals(1, published.size(), "nothing left: not published twice");
    }

    @Test
    void nativeDevicesAreNotApprovedByHandAndTraccarDevicesGetNoCommands() {
        devices.register(ACME, new DeviceRequest("356307042441013", "FMB920", null, "ABCD12", null), "ana");
        assertThrows(IllegalStateException.class, () -> activation.approve("356307042441013", "owner"));
        assertThrows(NoSuchElementException.class, () -> activation.approve("000000000000000", "owner"));

        devices.register(ACME, new DeviceRequest(H02_ID, "ST-901", null, "WXYZ99", null), "ana");
        assertThrows(IllegalStateException.class, () -> devices.command(ACME, H02_ID, "getinfo", "ana"));
        assertThrows(IllegalStateException.class,
                () -> devices.startIntensive(ACME, H02_ID, Duration.ofMinutes(10), null, "ana"));
    }

    @Test
    void identifiersAreValidatedByBrand() {
        assertThrows(IllegalArgumentException.class,
                () -> devices.register(ACME, new DeviceRequest("4209950057", "FMB920", null, "ABCD12", null), "ana"),
                "a Teltonika needs a 15-digit IMEI");
        devices.register(ACME, new DeviceRequest(H02_ID, "ST-901", null, "ABCD12", null), "ana");
        assertThrows(IllegalArgumentException.class,
                () -> devices.register(ACME, new DeviceRequest("ab", "GT06N", null, "ABCD12", null), "ana"));
        assertThrows(IllegalArgumentException.class,
                () -> devices.register(ACME, new DeviceRequest(GT06_ID, "XYZ1", null, "ABCD12", null), "ana"),
                "a model outside the catalog");
    }

    @Test
    void inputProfilesNameTheInputsOfAnyBrand() throws Exception {
        var input = profiles.saveInput(ACME, null, new InputRequest("Furgón refrigerado", null, List.of(
                new MappingRequest("din1", "door", "Puerta trasera", null, null, null, null),
                new MappingRequest("ain1", "refrigeration", "Equipo de frío", null, 6.0, null, null))), "ana");
        approved(GT06_ID, "GT06N");
        devices.setProfiles(ACME, GT06_ID, null, input.profile().id(), false, "ana");

        Instant t = Instant.now().minusSeconds(60);
        ingest.handle(position(GT06_ID, t, "{\"in1\":false,\"adc1\":0.2}"), "traccar");
        ingest.handle(position(GT06_ID, t.plusSeconds(10), "{\"in1\":true,\"adc1\":12.3}"), "traccar");

        var last = published.getLast().getPayload();
        assertEquals(List.of("door_open", "refrigeration_on"), last.getEvents().stream().map(Event::getEventType).toList());
        var io = last.getMetrics().getItems().stream().filter(i -> i.getK().equals(TraccarPosition.IO_METRIC))
                .findFirst().orElseThrow();
        @SuppressWarnings("unchecked")
        var inputs = (Map<String, Object>) ((Map<String, Object>) io.getV()).get("inputs");
        assertEquals(true, inputs.get("Puerta trasera"));
        assertEquals(1, profiles.inputProfile(ACME, input.profile().id()).devices());
        assertThrows(IllegalStateException.class, () -> profiles.deleteInput(ACME, input.profile().id()),
                "in use");
    }

    @Test
    void aConfigurationProfileIsShownInTheGuideAndSentToANativeDevice() {
        var config = profiles.saveConfig(ACME, null, new ConfigRequest("Minería", "Faenas sin cobertura",
                Map.of("10050", "60", "102", "0", "50020", "1")), "ana");
        approved("356307042441013", "FMB920");
        devices.setProfiles(ACME, "356307042441013", config.profile().id(), null, true, "ana");

        var guide = devices.connection(ACME, "356307042441013");
        assertEquals("60", guide.parameters().stream().filter(p -> p.id() == 10050).findFirst().orElseThrow().value());
        var sent = stores.commands().list("356307042441013", 10);
        assertEquals("setparam 102:0;10050:60;50020:1", sent.getFirst().command());
        assertThrows(IllegalArgumentException.class, () -> profiles.saveConfig(ACME, null,
                new ConfigRequest("Mala", null, Map.of("2004", "evil.example.com")), "ana"), "server is never in a profile");
        assertThrows(NoSuchElementException.class, () -> profiles.configProfile("other", config.profile().id()),
                "another organization does not see it");

        approved(GT06_ID, "GT06N");
        assertThrows(IllegalStateException.class,
                () -> devices.setProfiles(ACME, GT06_ID, config.profile().id(), null, true, "ana"),
                "a profile cannot be sent through Traccar");
    }

    @Test
    void theForwardEndpointChecksItsKeyAndHowItAnswers() throws Exception {
        approved(GT06_ID, "GT06N");
        var resource = new TraccarForwardResource(ingest, Optional.of("s3cret"), () -> true);
        String body = position(GT06_ID, Instant.now(), "{}").toString();

        assertEquals(401, resource.position("wrong", body).await().indefinitely().getStatus());
        assertEquals(401, resource.position(null, body).await().indefinitely().getStatus());
        assertEquals(503, new TraccarForwardResource(ingest, Optional.empty(), () -> true).position("s3cret", body).await()
                .indefinitely().getStatus(), "not configured");
        assertEquals(503, new TraccarForwardResource(ingest, Optional.of("s3cret"), () -> false).position("s3cret", body)
                .await().indefinitely().getStatus(), "registry not loaded: Traccar retries instead of dropping");
        assertEquals(200, resource.position("s3cret", body).await().indefinitely().getStatus());
        assertEquals(400, resource.position("s3cret", "{\"x\":1}").await().indefinitely().getStatus());
        var unknown = resource.position("s3cret", position("999999", Instant.now(), "{}").toString()).await()
                .indefinitely();
        assertEquals(200, unknown.getStatus(), "Traccar must not retry an unknown device");
        assertEquals(TraccarIngest.Result.UNKNOWN, ((TraccarIngest.Result) unknown.getEntity()).outcome());

        brokerDown.set(true);
        assertEquals(503, resource.position("s3cret", position(GT06_ID, Instant.now().plusSeconds(1), "{}").toString())
                .await().indefinitely().getStatus(), "Traccar retries");
    }

    @Test
    void eachDeviceReportsOnlyThroughTheChannelOfItsModel() throws Exception {
        approved("356307042441013", "FMB920");
        approved(GT06_ID, "GT06N");
        assertEquals(TraccarIngest.Result.WRONG_CHANNEL,
                ingest.handle(position("356307042441013", Instant.now(), "{}"), "traccar").outcome(),
                "a native Teltonika cannot be fed through Traccar (OsmAnd carries only the id)");
        assertEquals(TraccarIngest.Result.WRONG_CHANNEL, ingest.handle(osmand(GT06_ID), "traccar").outcome(),
                "a GT06N only through the gt06 protocol");
        assertTrue(published.isEmpty());
        var nativeView = com.microboxlabs.miot.teltonika.catalog.ChannelRules.nativeView(registry, CATALOG);
        assertTrue(nativeView.find("356307042441013").isPresent());
        assertTrue(nativeView.find(GT06_ID).isEmpty(), "the native receivers do not hear a Traccar model");
    }

    private static com.fasterxml.jackson.databind.JsonNode osmand(String id) throws Exception {
        var json = position(id, Instant.now(), "{}");
        ((com.fasterxml.jackson.databind.node.ObjectNode) json.get("position")).put("protocol", "osmand");
        return json;
    }

    private void approved(String id, String model) {
        devices.register(ACME, new DeviceRequest(id, model, null, "ABCD12",
                OffsetDateTime.now(ZoneOffset.UTC).minusDays(1)), "ana");
        var d = stores.devices().find(id).orElseThrow();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        stores.devices().update(d.with(d.model(), d.label(), true, now, null, now, "t"));
        registry.invalidate(id);
    }

    private static com.fasterxml.jackson.databind.JsonNode position(String id, Instant t, String attributes)
            throws Exception {
        String time = DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(t.atOffset(ZoneOffset.UTC));
        return JSON.readTree("""
                {"position":{"protocol":"gt06","fixTime":"%s","valid":true,"latitude":-33.45,"longitude":-70.66,
                 "altitude":570,"speed":10.0,"course":90,"attributes":%s},"device":{"uniqueId":"%s"}}"""
                .formatted(time, attributes, id));
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
