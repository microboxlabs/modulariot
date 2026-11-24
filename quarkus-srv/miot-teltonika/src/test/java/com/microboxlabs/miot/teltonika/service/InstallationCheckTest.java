package com.microboxlabs.miot.teltonika.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.monitor.DeviceStatus;
import com.microboxlabs.miot.teltonika.service.InstallationCheck.Item;
import com.microboxlabs.miot.teltonika.service.InstallationCheck.Result;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class InstallationCheckTest {

    private static final Instant NOW = Instant.parse("2026-11-16T12:00:00Z");
    private static final OffsetDateTime T = OffsetDateTime.parse("2026-11-01T00:00:00Z");
    private static final Device ACTIVE = new Device("356307042441013", "acme", "FMB920", null, true, null, T, null,
            null, T, "a", T, "a");

    @Test
    void wellInstalledDeviceIsReady() {
        var report = InstallationCheck.evaluate(ACTIVE, status(true, true, 27_800, 4, 30, 0, "0136A24F000000C7"), NOW);

        assertTrue(report.ready());
        report.items().forEach(i -> assertEquals(Result.OK, i.result(), i.code()));
    }

    @Test
    void ignitionSeenOnlyOnIsPendingAndBlocksReady() {
        var report = InstallationCheck.evaluate(ACTIVE, status(true, false, 27_800, 4, 30, 0, null), NOW);
        Map<String, Item> items = byCode(report);

        assertFalse(report.ready());
        assertEquals(Result.PENDING, items.get("ignition").result());
        assertTrue(items.get("ignition").detail().contains("apagar"));
        assertEquals(Result.PENDING, items.get("ibutton").result(), "optional");
    }

    @Test
    void deviceOnInternalBatteryFailsPower() {
        var report = InstallationCheck.evaluate(ACTIVE, status(true, true, 4_100, 4, 30, 0, null), NOW);

        assertFalse(report.ready());
        assertEquals(Result.FAIL, byCode(report).get("power").result());
    }

    @Test
    void pendingDeviceIsNotReady() {
        Device pending = new Device("356307042441013", "acme", "FMB920", null, true, "123456", null, T, null, T, "a",
                T, "a");
        var report = InstallationCheck.evaluate(pending, status(true, true, 27_800, 4, 30, 0, null), NOW);

        assertFalse(report.ready());
        assertTrue(byCode(report).get("activation").detail().contains("123456"));
    }

    @Test
    void weakSignalSleepAndSlowFrequencyWarnWithoutBlocking() {
        var report = InstallationCheck.evaluate(ACTIVE, status(true, true, 27_800, 2, 300, 2, null), NOW);
        Map<String, Item> items = byCode(report);

        assertTrue(report.ready());
        assertEquals(Result.WARN, items.get("gsm").result());
        assertEquals(Result.WARN, items.get("frequency").result());
        assertEquals(Result.WARN, items.get("sleep").result());
    }

    private static Map<String, Item> byCode(InstallationCheck.Report report) {
        return report.items().stream().collect(Collectors.toMap(Item::code, i -> i));
    }

    private static DeviceStatus status(boolean ignOn, boolean ignOff, int mv, int gsm, int interval, int sleep,
            String ibutton) {
        OffsetDateTime t = OffsetDateTime.ofInstant(NOW.minus(Duration.ofSeconds(20)), ZoneOffset.UTC);
        return new DeviceStatus("1", t.minusHours(1), t, t, "1.2.3.4:5", 1, 10, 50, 0, 0, 0, 0, -33.4, -70.6, t,
                1, 11, gsm, mv, 4_080, sleep, 1, ignOff ? Boolean.FALSE : Boolean.TRUE, ignOn ? t : null,
                ignOff ? t : null, ibutton, ibutton == null ? null : t, interval);
    }
}
