package com.microboxlabs.miot.teltonika.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.teltonika.command.DeviceCommand;
import com.microboxlabs.miot.teltonika.command.IntensiveTracking;
import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.inputs.InputMapping;
import com.microboxlabs.miot.teltonika.inputs.InputProfile;
import com.microboxlabs.miot.teltonika.profile.ConfigProfile;
import com.microboxlabs.miot.teltonika.profile.ConfigRules;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.monitor.StatusDelta;
import com.microboxlabs.miot.teltonika.protocol.AvlRecord;
import com.microboxlabs.miot.teltonika.protocol.CodecParser;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder;
import com.microboxlabs.miot.teltonika.tools.Fmb920Emulator;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The migration and the stores on real PostgreSQL with pg_partman. The migration runs in a scratch
 * schema that stands in for {@code miot_teltonika}, so a database the modulith already migrated is
 * left alone. Skipped unless {@code -Dmiot.teltonika.test.pg-url=…} is set; never point it at a
 * shared database.
 */
@EnabledIfSystemProperty(named = "miot.teltonika.test.pg-url", matches = ".+")
class PgStoresTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String IMEI = "356307042441013";
    private static final String TENANT = "acme-client";
    private static final OffsetDateTime T0 = OffsetDateTime.now(ZoneOffset.UTC).withNano(0);

    private Vertx vertx;
    private Pool pool;
    private String schema;
    private PgDeviceStore devices;
    private PgMonitorStore monitor;
    private PgCommandStore commands;

    @BeforeEach
    void setup() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.teltonika.test.pg-url")))
                .with(new PoolOptions().setMaxSize(4)).using(vertx).build();
        schema = "cert_teltonika_" + UUID.randomUUID().toString().replace("-", "");
        try (InputStream in = getClass().getResourceAsStream("/db/migration/teltonika/V0.14.0__create_teltonika.sql")) {
            String migration = new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("miot_teltonika", schema);
            pool.query(migration).execute().await().atMost(TIMEOUT);
        }
        devices = new PgDeviceStore(() -> pool, schema);
        monitor = new PgMonitorStore(() -> pool, schema);
        commands = new PgCommandStore(() -> pool, schema);
    }

    @AfterEach
    void cleanup() {
        if (pool != null) {
            pool.query("DROP SCHEMA IF EXISTS " + schema + " CASCADE").execute().await().atMost(TIMEOUT);
            pool.preparedQuery("DELETE FROM partman.part_config WHERE parent_table LIKE $1")
                    .execute(Tuple.of(schema + ".%")).await().atMost(TIMEOUT);
            pool.closeAndAwait();
        }
        if (vertx != null) {
            vertx.closeAndAwait();
        }
    }

    @Test
    void registrationIsOneTransactionAndAssignmentsFollowTime() {
        devices.register(device(T0, null), "ABCD12", T0.minusDays(7), "ana");
        devices.reassign(IMEI, "EFGH34", T0.plusHours(1), "ana");

        var registered = devices.activeDevices().getFirst();
        assertTrue(registered.activated());
        assertEquals("ABCD12", registered.assetAt(T0.minusDays(1).toInstant()).orElseThrow());
        assertEquals("EFGH34", registered.assetAt(T0.plusHours(2).toInstant()).orElseThrow());
        assertThrows(IllegalStateException.class, () -> devices.register(device(T0, null), "X1234", T0, "a"),
                "IMEI is unique");
        assertEquals(1, devices.assignments(IMEI).stream().filter(a -> a.open()).count(),
                "the failed registration left no second assignment");

        devices.update(devices.find(IMEI).orElseThrow().with("FMB920", null, false, T0, null, T0, "ana"));
        devices.closeAssignment(IMEI, T0.plusHours(3));
        assertTrue(devices.activeDevices().isEmpty());
    }

    @Test
    void anExpiredPendingClaimCanBeDeletedButNotAnActiveDevice() {
        devices.register(device(null, T0.minusMinutes(1)), "ABCD12", T0, "ana");
        devices.deleteExpiredClaim(IMEI);
        assertTrue(devices.find(IMEI).isEmpty());

        devices.register(device(T0, null), "ABCD12", T0, "ana");
        devices.deleteExpiredClaim(IMEI);
        assertTrue(devices.find(IMEI).isPresent());
    }

    @Test
    void statusCountersAddUpLastValuesMoveForwardAndSightingsReset() {
        devices.register(device(T0, null), "ABCD12", T0, "ana");
        List<AvlRecord> trip = trip();
        StatusDelta newer = new StatusDelta(IMEI);
        newer.connected("1.2.3.4:5", Instant.now());
        newer.packet(Instant.now());
        newer.record(trip.get(10));
        newer.outcome(5, 0, 0);
        monitor.applyStatus(List.of(newer.drain()));

        StatusDelta older = new StatusDelta(IMEI);
        older.packet(Instant.now());
        older.record(trip.get(2));
        older.outcome(3, 1, 0);
        monitor.applyStatus(List.of(older.drain()));

        var s = monitor.status(IMEI).orElseThrow();
        assertEquals(2, s.packets());
        assertEquals(8, s.recordsPublished());
        assertEquals(trip.get(10).timestamp(), s.lastRecordAt().toInstant(), "an older record does not go back");
        assertEquals("0136A24F000000C7", s.lastIbutton());
        assertNotNull(s.ignitionOnSeenAt());

        monitor.resetSightings(IMEI);
        StatusDelta stale = new StatusDelta(IMEI);
        byte[] old = AvlPacketEncoder.codec8Extended(Fmb920Emulator.santiagoTrip(T0.minusHours(2).toInstant(),
                Duration.ofSeconds(30)));
        stale.record(CodecParser.parse(Arrays.copyOfRange(old, 8, old.length - 4)).records().get(12));
        monitor.applyStatus(List.of(stale.drain()));
        var after = monitor.status(IMEI).orElseThrow();
        assertNull(after.ignitionOnSeenAt(), "sightings from before the reset do not count again");
        assertNull(after.lastIbutton());
    }

    @Test
    void packetLogIsPartitionedKeepsRawBytesAndReplaysPendingOnes() {
        byte[] raw = AvlPacketEncoder.codec8Extended(Fmb920Emulator.santiagoTrip(T0.toInstant(),
                Duration.ofSeconds(30)).subList(0, 2));
        monitor.appendPackets(List.of(
                new PacketLogEntry(IMEI, TENANT, T0, "1.2.3.4:5", PacketLogEntry.PENDING_ACTIVATION, "pending", 0x8E, 2,
                        raw),
                new PacketLogEntry(IMEI, TENANT, T0.minusDays(30), null, PacketLogEntry.CRC_ERROR, null, null, null,
                        raw)));

        assertEquals(2, monitor.packets(IMEI, 10).size(), "an old packet lands in the default partition");
        var kept = monitor.pendingActivation(IMEI);
        assertTrue(Arrays.equals(raw, kept.getFirst().entry().packet()));
        assertEquals(List.of(IMEI), monitor.devicesWithPendingPackets());
        monitor.markReplayed(IMEI, List.of(kept.getFirst().id()));
        assertTrue(monitor.pendingActivation(IMEI).isEmpty());
        monitor.applyRetention(T0.minusDays(7));
        long partitions = pool.preparedQuery("SELECT count(*) FROM pg_inherits WHERE inhparent = $1::regclass")
                .execute(Tuple.of(schema + ".packet_log")).await().atMost(TIMEOUT).iterator().next().getLong(0);
        assertTrue(partitions >= 2, "daily partitions plus default");
    }

    @Test
    void commandsAreClaimedInArrivalOrderAndOnlyOnce() {
        devices.register(device(T0, null), "ABCD12", T0, "ana");
        var first = command("getparam 10050", DeviceCommand.INTENSIVE_READ);
        var second = command("setparam 10050:10", DeviceCommand.INTENSIVE_START);
        commands.insert(first);
        commands.insert(second);

        assertEquals(List.of(first.id(), second.id()),
                commands.pending(List.of(IMEI), T0, 10).stream().map(DeviceCommand::id).toList(),
                "same instant: arrival order");
        assertTrue(commands.markSent(first.id(), T0));
        assertFalse(commands.markSent(first.id(), T0), "a second instance cannot take it");
        commands.release(first.id());
        assertTrue(commands.hasOpen(IMEI, DeviceCommand.INTENSIVE_READ));
        assertTrue(commands.markSent(first.id(), T0), "released: available again");
        commands.markAnswered(first.id(), "Param ID:10050 Value:30", T0);
        assertEquals(DeviceCommand.ANSWERED, commands.find(first.id()).orElseThrow().status());
    }

    @Test
    void intensiveTrackingKeepsPreviousValuesAndEndsOnce() {
        devices.register(device(T0, null), "ABCD12", T0, "ana");
        commands.saveIntensive(new IntensiveTracking(IMEI, TENANT, T0, T0.plusMinutes(30), "caso", "ana", null, null,
                null));
        commands.addPreviousParam(IMEI, 10050, "45");
        commands.addPreviousParam(IMEI, 10055, "60");

        assertEquals("45", commands.intensive(IMEI).orElseThrow().previous().get(10050));
        assertEquals(1, commands.dueIntensive(T0.plusMinutes(31)).size());
        assertTrue(commands.endIntensive(IMEI, T0.plusMinutes(31)));
        assertFalse(commands.endIntensive(IMEI, T0.plusMinutes(31)), "a second instance does nothing");
        assertEquals(1, commands.unrestored().size());
        commands.markRestored(IMEI, T0.plusMinutes(32));
        assertTrue(commands.unrestored().isEmpty());
    }

    @Test
    void clusterLockLetsOneInstanceRunAJob() throws Exception {
        var lock = new PgClusterLock(() -> pool);
        CountDownLatch inside = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicBoolean secondRan = new AtomicBoolean();
        Thread holder = Thread.ofVirtual().start(() -> lock.runExclusively(schema, () -> {
            inside.countDown();
            try {
                release.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }));
        assertTrue(inside.await(5, TimeUnit.SECONDS));
        assertFalse(lock.runExclusively(schema, () -> secondRan.set(true)));
        release.countDown();
        holder.join(5_000);
        assertFalse(secondRan.get());
        assertTrue(lock.runExclusively(schema, () -> { }), "free again");
    }

    @Test
    void assetDirectoryRefusesAnAssetOfAnotherClient() {
        String table = schema + ".asset_client_map";
        pool.query("CREATE TABLE " + table + " (asset_id text, shared_client_id text, active boolean,"
                + " valid_from timestamptz, valid_to timestamptz)").execute().await().atMost(TIMEOUT);
        pool.query("INSERT INTO " + table + " VALUES ('THEIRS1', 'other', true, now(), null),"
                + " ('SHARED1', 'other', true, now(), null), ('SHARED1', '" + TENANT + "', true, now(), null)")
                .execute().await().atMost(TIMEOUT);
        var directory = new PgAssetDirectory(() -> pool, table);

        assertFalse(directory.mayAssign(TENANT, "THEIRS1"));
        assertTrue(directory.mayAssign(TENANT, "SHARED1"));
        assertTrue(directory.mayAssign(TENANT, "NEW0001"));
        assertTrue(new PgAssetDirectory(() -> pool, schema + ".missing").mayAssign(TENANT, "THEIRS1"),
                "without the tracking table every asset is allowed");
    }

    @Test
    void theCatalogIsSeededWithNativeAndTraccarModels() {
        var catalog = new PgModelCatalog(() -> pool, schema);
        assertTrue(catalog.find("fmb920").orElseThrow().isNative());
        var gt06 = catalog.find("GT06N").orElseThrow();
        assertEquals("traccar", gt06.via());
        assertEquals(5023, gt06.traccarPort());
        assertTrue(catalog.all().size() >= 15);
        assertThrows(IllegalArgumentException.class, () -> devices.register(new Device(IMEI, TENANT, "NOPE1", null, true,
                null, T0, null, null, T0, "a", T0, "a"), "ABCD12", T0, "a"), "the model must be in the catalog");
    }

    @Test
    void profilesWithTheirMappingsReachTheRegistry() {
        var profiles = new PgProfileStore(() -> pool, schema);
        var input = new InputProfile(UUID.randomUUID(), TENANT, "Furgón", "puerta y frío", List.of(
                new InputMapping("din2", "door", "Puerta trasera", true, null, true, true),
                new InputMapping("ain1", "refrigeration", "Frío", true, 6.0, true, false)), T0, "ana", T0, "ana");
        profiles.saveInput(input);
        var config = new ConfigProfile(UUID.randomUUID(), TENANT, "Minería", null, "fmb9xx",
                ConfigRules.validate(java.util.Map.of(10050, "60", 102, "0")), T0, "ana", T0, "ana");
        profiles.saveConfig(config);
        assertThrows(IllegalStateException.class, () -> profiles.saveConfig(new ConfigProfile(UUID.randomUUID(), TENANT,
                "Minería", null, "fmb9xx", config.params(), T0, "a", T0, "a")), "names are unique per organization");

        devices.register(device(T0, null), "ABCD12", T0.minusDays(1), "ana");
        Device d = devices.find(IMEI).orElseThrow();
        assertTrue(devices.update(d.withProfiles(config.id(), input.id(), T0, "ana")));

        var registered = devices.activeDevices().getFirst();
        assertEquals(2, registered.inputs().size());
        assertEquals(6.0, registered.inputs().stream().filter(m -> m.source().equals("ain1")).findFirst()
                .orElseThrow().thresholdV());
        assertEquals(registered.inputs(), devices.inputMappings(input.id()));
        assertEquals(config.params(), profiles.configProfile(config.id()).orElseThrow().params());
        assertEquals(2, profiles.devicesUsing(input.id()) + profiles.devicesUsing(config.id()));
        assertEquals(1, profiles.inputProfiles(TENANT).size());

        // Replacing the mappings replaces them all.
        profiles.saveInput(new InputProfile(input.id(), TENANT, "Furgón", null,
                List.of(new InputMapping("din1", "panic", "Pánico", false, null, true, false)), T0, "ana", T0, "ana"));
        assertEquals(List.of("din1"), devices.inputMappings(input.id()).stream().map(InputMapping::source).toList());

        // Deleting a profile leaves the device without it.
        assertTrue(profiles.deleteConfig(TENANT, config.id()));
        assertNull(devices.find(IMEI).orElseThrow().configProfileId());
    }

    @Test
    void pendingClaimsAndPacketFormats() {
        devices.register(device(null, T0.plusDays(3)), "ABCD12", T0, "ana");
        devices.register(new Device("4209950057", TENANT, "ST-901", null, true, null, null, T0.plusDays(3), null, T0,
                "ana", T0, "ana"), "WXYZ99", T0, "ana");
        assertEquals(2, devices.pendingClaims().size());

        monitor.appendPackets(List.of(new PacketLogEntry("4209950057", TENANT, T0, "traccar",
                PacketLogEntry.PENDING_ACTIVATION, null, null, 1, "{\"position\":{}}".getBytes(StandardCharsets.UTF_8),
                PacketLogEntry.TRACCAR_JSON)));
        assertEquals(PacketLogEntry.TRACCAR_JSON, monitor.pendingActivation("4209950057").getFirst().entry().format());
    }

    private static Device device(OffsetDateTime activatedAt, OffsetDateTime claimExpiresAt) {
        return new Device(IMEI, TENANT, "FMB920", "grúa", true, activatedAt == null ? "123456" : null, activatedAt,
                claimExpiresAt, null, T0, "ana", T0, "ana");
    }

    private static DeviceCommand command(String text, String purpose) {
        return new DeviceCommand(UUID.randomUUID(), IMEI, TENANT, text, purpose, DeviceCommand.PENDING, null, "ana", T0,
                null, null, T0.plusDays(1));
    }

    private static List<AvlRecord> trip() {
        byte[] p = AvlPacketEncoder.codec8Extended(Fmb920Emulator.santiagoTrip(T0.toInstant(), Duration.ofSeconds(30)));
        return CodecParser.parse(Arrays.copyOfRange(p, 8, p.length - 4)).records();
    }
}
