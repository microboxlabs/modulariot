package com.microboxlabs.miot.teltonika.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.store.InMemoryStores;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Intensive tracking reads the device's own values, raises the frequency and restores those values. */
class CommandServiceTest {

    private static final String IMEI = "356307042441013";
    private static final OffsetDateTime T0 = OffsetDateTime.parse("2026-11-16T12:00:00Z");
    private final InMemoryStores.Commands store = new InMemoryStores.Commands();
    private Instant now = T0.toInstant();
    private final Clock clock = new Clock() {
        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    };
    private final CommandService service = new CommandService(store, clock);
    private final Device device = new Device(IMEI, "acme", "FMB920", null, true, null, T0, null, null, T0, "a", T0, "a");

    @Test
    void readsThePreviousValuesBeforeRaisingTheFrequency() {
        service.startIntensive(device, Duration.ofMinutes(30), "caso 7", "ana");

        List<DeviceCommand> queued = store.all();
        assertEquals(List.of("getparam 10050", "getparam 10055", "getparam 10000", "getparam 10005",
                "setparam 10050:10;10055:10;10000:30;10005:30"), queued.stream().map(DeviceCommand::command).toList());
        assertThrows(IllegalStateException.class,
                () -> service.startIntensive(device, Duration.ofMinutes(30), null, "ana"), "already running");
    }

    @Test
    void restoresTheDevicesOwnValuesAndRetriesUntilConfirmed() {
        service.startIntensive(device, Duration.ofMinutes(30), "caso 7", "ana");
        for (DeviceCommand c : store.all()) {
            if (DeviceCommand.INTENSIVE_READ.equals(c.purpose())) {
                String id = c.command().substring("getparam ".length());
                service.answered(c, "Param ID:" + id + " Value:" + (id.equals("10050") ? "45" : "120"));
            }
        }
        now = now.plus(Duration.ofMinutes(31));
        assertEquals(1, service.endDue());
        assertEquals(0, service.endDue(), "a second instance finds it already ended");

        DeviceCommand restore = last();
        assertEquals(DeviceCommand.INTENSIVE_END, restore.purpose());
        assertEquals("setparam 10050:45;10055:120;10000:120;10005:120", restore.command(), "the device's own values");
        assertTrue(restore.expiresAt().isAfter(T0.plusDays(29)), "a restore waits for weeks without coverage");

        store.markFailed(restore.id(), "connection closed", T0);
        assertEquals(1, service.retryRestores(), "queued again after a failure");
        assertEquals(0, service.retryRestores(), "not twice while one is open");
        DeviceCommand retry = last();
        service.answered(retry, "New value 10050:45;10055:120;10000:120;10005:120");
        assertNotNull(store.intensive(IMEI).orElseThrow().restoredAt());
        assertEquals(0, service.retryRestores());
        assertEquals(0, service.unrestoredCount());
    }

    @Test
    void withoutThePreviousValuesTheStandardProfileIsRestored() {
        service.startIntensive(device, Duration.ofMinutes(30), null, "ana");
        assertTrue(service.endIntensive(IMEI, "acme", "ana"));

        assertEquals("setparam 10050:30;10055:30;10000:600;10005:120", last().command());
        assertFalse(service.endIntensive(IMEI, "acme", "ana"), "already ended");
    }

    @Test
    void eachValueFallsBackToReadThenProfileThenStandard() {
        var withProfile = new CommandService(store, clock, imei -> Map.of(10050, "20", 10000, "300"));
        withProfile.startIntensive(device, Duration.ofMinutes(30), null, "ana");
        DeviceCommand read10055 = store.list(IMEI, 20).stream()
                .filter(c -> c.command().equals("getparam 10055")).findFirst().orElseThrow();
        withProfile.answered(read10055, "Param ID:10055 Value:45");
        assertTrue(withProfile.endIntensive(IMEI, "acme", "ana"));

        assertEquals("setparam 10050:20;10055:45;10000:300;10005:120", last().command(),
                "10055 as read, 10050 and 10000 from the profile, 10005 standard");
    }

    @Test
    void aPreviousValueThatIsNotANumberInRangeIsNotRestored() {
        service.startIntensive(device, Duration.ofMinutes(30), null, "ana");
        for (DeviceCommand c : store.all()) {
            if (c.command().equals("getparam 10050")) {
                service.answered(c, "Param ID:10050 Value:30;2004:evil.example.com");
            } else if (c.command().equals("getparam 10055")) {
                service.answered(c, "Param ID:10055 Value:999999999");
            }
        }
        assertTrue(service.endIntensive(IMEI, "acme", "ana"));
        assertEquals("setparam 10050:30;10055:30;10000:600;10005:120", last().command(),
                "no injected parameter, out-of-range value replaced by the standard");
    }

    @Test
    void aLongProfileIsSentInSeveralCommandsInOrder() {
        Map<Integer, String> params = new java.util.LinkedHashMap<>();
        for (int i = 0; i < 60; i++) {
            params.put(50000 + i * 10, "1");
        }
        var sent = service.applyProfile(device, params, "ana");

        assertTrue(sent.size() > 1);
        sent.forEach(c -> {
            assertEquals(DeviceCommand.PROFILE, c.purpose());
            assertTrue(c.command().length() <= CommandService.MAX_COMMAND);
        });
        String joined = sent.stream().map(c -> c.command().substring("setparam ".length()))
                .reduce((a, b) -> a + ";" + b).orElseThrow();
        assertEquals(60, joined.split(";").length, "every parameter, once");
        assertTrue(joined.startsWith("50000:1;50010:1"));
    }

    @Test
    void anAnswerWithoutNewValueDoesNotConfirmTheRestore() {
        service.startIntensive(device, Duration.ofMinutes(30), null, "ana");
        service.endIntensive(IMEI, "acme", "ana");
        service.answered(last(), "Param ID:10050 is not supported");

        assertNull(store.intensive(IMEI).orElseThrow().restoredAt());
        assertEquals(1, service.unrestoredCount());
    }

    private DeviceCommand last() {
        List<DeviceCommand> all = store.all();
        return all.get(all.size() - 1);
    }
}
