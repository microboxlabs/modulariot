package com.microboxlabs.miot.teltonika.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.teltonika.command.CommandService;
import com.microboxlabs.miot.teltonika.device.AssetDirectory;
import com.microboxlabs.miot.teltonika.device.CachedDeviceRegistry;
import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.guide.ConnectionGuide;
import com.microboxlabs.miot.teltonika.service.DeviceService.DeviceRequest;
import com.microboxlabs.miot.teltonika.store.InMemoryStores;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.Test;

class DeviceServiceTest {

    private static final String ACME = "acme-client";
    private static final String OTHER = "other-client";
    private static final String IMEI = "356307042441013";
    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-16T12:00:00Z"));
    private final InMemoryStores.Set stores = InMemoryStores.Set.create();
    private final CachedDeviceRegistry registry = new CachedDeviceRegistry(stores.devices());
    private final CommandService commands = new CommandService(stores.commands(), clock);
    private AssetDirectory assets = AssetDirectory.open();
    private final DeviceService service = service(DeviceService.Settings.defaults());

    private DeviceService service(DeviceService.Settings settings) {
        return new DeviceService(stores.devices(), stores.monitor(), stores.commands(), commands, registry,
                new ConnectionGuide("devices.example.com", 5027), (t, a) -> assets.mayAssign(t, a), settings, clock);
    }

    @Test
    void registrationIsAPendingClaimWithAnActivationCode() {
        var detail = service.register(ACME, new DeviceRequest(IMEI, null, "Grúa 3", "abcd-12", null), "ana");

        assertEquals("pending", detail.device().state());
        assertTrue(detail.device().activationCode().matches("\\d{6}"));
        assertEquals("ABCD12", detail.device().assetId(), "plates are normalized");
        RegisteredDevice seen = registry.find(IMEI).orElseThrow();
        assertFalse(seen.activated(), "the receiver accepts it but does not publish yet");
        var guide = service.connection(ACME, IMEI);
        assertEquals(detail.device().activationCode(), guide.parameters().getFirst().value());
        assertEquals(ConnectionGuide.ACTIVATION_PARAM, guide.parameters().getFirst().id());
    }

    @Test
    void firstAssignmentCoversWhatTheDeviceBufferedBeforeRegistration() {
        service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");

        RegisteredDevice d = registry.find(IMEI).orElseThrow();
        assertEquals("ABCD12", d.assetAt(clock.instant().minus(Duration.ofDays(6))).orElseThrow(),
                "a record buffered the day before registration still has its asset");
        assertTrue(d.assetAt(clock.instant().minus(Duration.ofDays(8))).isEmpty());
    }

    @Test
    void anImeiOfAnotherOrganizationIsNotAvailableWithoutSayingWhy() {
        service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");

        var e = assertThrows(NoSuchElementException.class,
                () -> service.register(OTHER, new DeviceRequest(IMEI, null, null, "ZZZZ99", null), "bob"));
        assertEquals("the device is not available for registration", e.getMessage());
        assertThrows(NoSuchElementException.class, () -> service.get(OTHER, IMEI));
        assertThrows(IllegalStateException.class,
                () -> service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana"),
                "the same organization is told it already has it");
    }

    @Test
    void anExpiredClaimCanBeTakenByAnotherOrganization() {
        service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");
        clock.advance(Duration.ofHours(73));

        var detail = service.register(OTHER, new DeviceRequest(IMEI, null, null, "ZZZZ99", null), "bob");
        assertEquals("pending", detail.device().state());
        assertEquals(OTHER, stores.devices().find(IMEI).orElseThrow().tenantCode());
        assertThrows(NoSuchElementException.class, () -> service.get(ACME, IMEI));
    }

    @Test
    void invalidInputIsABadRequest() {
        assertThrows(IllegalArgumentException.class,
                () -> service.register(ACME, new DeviceRequest("356307042441014", null, null, "ABCD12", null), "ana"),
                "Luhn check digit");
        assertThrows(IllegalArgumentException.class,
                () -> service.register(ACME, new DeviceRequest(IMEI, "FMB140", null, "ABCD12", null), "ana"));
        assertThrows(IllegalArgumentException.class,
                () -> service.register(ACME, new DeviceRequest(IMEI, null, null, "AB", null), "ana"));
    }

    @Test
    void anAssetAnotherOrganizationReceivesIsRefused() {
        assets = (tenant, asset) -> !asset.equals("THEIRS1");

        assertThrows(IllegalArgumentException.class,
                () -> service.register(ACME, new DeviceRequest(IMEI, null, null, "THEIRS1", null), "ana"));
        service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");
        clock.advance(Duration.ofHours(1));
        assertThrows(IllegalArgumentException.class, () -> service.reassign(ACME, IMEI, "THEIRS1", null, "ana"));
    }

    @Test
    void reassignmentKeepsEachRecordWithItsAssetAndRestartsTheInstallationCheck() {
        service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");
        Instant before = clock.instant();
        clock.advance(Duration.ofHours(1));
        service.reassign(ACME, IMEI, "EFGH34", null, "ana");

        RegisteredDevice d = registry.find(IMEI).orElseThrow();
        assertEquals("ABCD12", d.assetAt(before.plusSeconds(60)).orElseThrow(), "buffered record before the change");
        assertEquals("EFGH34", d.assetAt(clock.instant()).orElseThrow());
        assertThrows(IllegalArgumentException.class,
                () -> service.reassign(ACME, IMEI, "XYZ123", OffsetDateTime.parse("2026-01-01T00:00:00Z"), "ana"),
                "a new assignment cannot start before the open one");
    }

    @Test
    void deactivatedDeviceLeavesTheReceiver() {
        service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");
        var detail = service.deactivate(ACME, IMEI, "ana");

        assertEquals("inactive", detail.device().state());
        assertNull(detail.device().assetId());
        assertTrue(registry.find(IMEI).isEmpty());
        assertThrows(IllegalStateException.class, () -> service.command(ACME, IMEI, "getinfo", "ana"));
    }

    @Test
    void withoutActivationRequiredTheDeviceStartsActive() {
        var open = service(new DeviceService.Settings(false, Duration.ofHours(72), Duration.ofDays(7)));
        var detail = open.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");

        assertEquals("active", detail.device().state());
        assertNull(detail.device().activationCode());
        assertTrue(registry.find(IMEI).orElseThrow().activated());
    }

    @Test
    void commandsAreAClosedListWithSafeRanges() {
        var open = service(new DeviceService.Settings(false, Duration.ofHours(72), Duration.ofDays(7)));
        open.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");

        assertEquals("getinfo", open.command(ACME, IMEI, " GETINFO ", "ana").command());
        assertEquals("getparam 10050", open.command(ACME, IMEI, "getparam 10050", "ana").command());
        assertEquals("setparam 10050:15;10055:15",
                open.command(ACME, IMEI, "setparam 10050:15;10055:15", "ana").command());
        assertThrows(IllegalArgumentException.class, () -> open.command(ACME, IMEI, "setdigout 1", "ana"),
                "acting on the vehicle is not offered");
        assertThrows(IllegalArgumentException.class, () -> open.command(ACME, IMEI, "setparam 2004:1", "ana"),
                "the server cannot be changed remotely");
        assertThrows(IllegalArgumentException.class, () -> open.command(ACME, IMEI, "setparam 10050:1", "ana"),
                "one record per second is out of range");
        assertThrows(IllegalArgumentException.class, () -> open.command(ACME, IMEI, "setparam 10054:255", "ana"),
                "holding records for hours is out of range");
        assertThrows(IllegalArgumentException.class, () -> open.command(ACME, IMEI, "getparam 2003", "ana"),
                "the APN password cannot be read");
    }

    @Test
    void intensiveTrackingNeedsAnActivatedDevice() {
        service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");

        assertThrows(IllegalStateException.class,
                () -> service.startIntensive(ACME, IMEI, Duration.ofMinutes(30), "caso", "ana"));
    }

    @Test
    void captureKeepsPacketsForALimitedTime() {
        service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");
        service.capture(ACME, IMEI, Duration.ofMinutes(20), "ana");

        assertTrue(registry.find(IMEI).orElseThrow().capturing(clock.instant()));
        assertFalse(registry.find(IMEI).orElseThrow().capturing(clock.instant().plus(Duration.ofMinutes(21))));
        assertThrows(IllegalArgumentException.class, () -> service.capture(ACME, IMEI, Duration.ofHours(3), "ana"));
    }

    @Test
    void installationCheckOfAPendingDeviceNeverSeen() {
        service.register(ACME, new DeviceRequest(IMEI, null, null, "ABCD12", null), "ana");
        var report = service.installationCheck(ACME, IMEI);

        assertFalse(report.ready());
        assertEquals("activation", report.items().getFirst().code());
        assertEquals(InstallationCheck.Result.PENDING, report.items().getFirst().result());
        assertNotNull(report.items().getFirst().detail());
    }

    /** A clock tests move by hand. */
    static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
