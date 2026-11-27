package com.microboxlabs.miot.teltonika.mapping;

import static com.microboxlabs.miot.teltonika.mapping.TeltonikaIo.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.metrics.MetricItem;
import cl.streamhub.gps.model.metrics.MetricRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.teltonika.protocol.AvlRecord;
import com.microboxlabs.miot.teltonika.protocol.CodecParser;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder;
import com.microboxlabs.miot.teltonika.tools.Fmb920Emulator;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class AvlRecordMapperTest {

    private static final Instant START = Instant.parse("2026-11-16T12:00:00Z");
    private static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private final AvlRecordMapper mapper = new AvlRecordMapper("Teltonika");

    @Test
    void ignitionOnRecordOfTheSantiagoTrip() {
        AssetTrackingData data = mapper.map(trip().getFirst(), "TLTK01");

        assertEquals("TLTK01", data.getAssetId());
        assertEquals(START, data.getTimestamp().toInstant());
        assertEquals(-33.4489, data.getGps().getLatitude(), 1e-7);
        assertEquals(-70.6693, data.getGps().getLongitude(), 1e-7);
        assertEquals(11, data.getGps().getSatellites());
        assertTrue(data.getSensors().getEngineStatus());
        assertEquals(152_340.0, data.getSensors().getOdometer().getTotalDistance(), 1e-9);
        assertEquals("0136A24F000000C7", data.getDriverInfo().getIdButton());
        assertEquals("730", data.getTelecom().getMcc());
        assertEquals("01", data.getTelecom().getMnc());
        assertEquals("31207", data.getTelecom().getCellId());
        assertNull(data.getTelecom().getSignalStrength(), "signal_strength is dBm in the model, not 0-5");
        assertEquals("Teltonika", data.getTelecom().getGpsProvider());
        Map<String, Object> metrics = metrics(data);
        assertEquals(27.85, (Double) metrics.get("battery.voltage"), 1e-9);
        Map<String, Object> io = io(data);
        assertEquals(true, io.get("din1"));
        assertEquals(4L, io.get("gsm_signal"));
        assertEquals(0.8, (Double) io.get("hdop"), 1e-9);
        assertEquals(239, io.get("event_io_id"));
    }

    @Test
    void ignitionOffRecord() {
        AssetTrackingData data = mapper.map(trip().getLast(), "TLTK01");

        assertFalse(data.getSensors().getEngineStatus());
        assertEquals(0.0, data.getGps().getSpeed(), 1e-9);
    }

    @Test
    void harshBrakingBecomesAnEventOnlyOnTheRecordItGenerated() {
        List<AvlRecord> trip = trip();
        AssetTrackingData braking = mapper.map(trip.get(9), "TLTK01");
        AssetTrackingData periodic = mapper.map(withoutEventTrigger(trip.get(9)), "TLTK01");

        assertEquals(1, braking.getEvents().size());
        assertEquals("hard_brake", braking.getEvents().getFirst().getEventType());
        assertEquals(0.64, braking.getEvents().getFirst().getAdditionalInfo().getgForce(), 1e-9);
        assertNull(periodic.getEvents());
    }

    @Test
    void overSpeedingIsAnEventOnlyAtTheStart() {
        var start = new AvlPacketEncoder.Record(START).position(-33.4, -70.6, 0, 0, 9, 104)
                .event(OVER_SPEEDING).io1(OVER_SPEEDING, 104);

        assertEquals("speeding", mapper.map(decode(start), "TLTK01", true).getEvents().getFirst().getEventType());
        assertNull(mapper.map(decode(start), "TLTK01", false).getEvents(), "end of the episode");
    }

    @Test
    void impactOnlyForARealCrash() {
        var real = new AvlPacketEncoder.Record(START).position(-33.4, -70.6, 0, 0, 9, 0)
                .event(CRASH_DETECTION).io1(CRASH_DETECTION, 1);
        var partial = new AvlPacketEncoder.Record(START).position(-33.4, -70.6, 0, 0, 9, 0)
                .event(CRASH_DETECTION).io1(CRASH_DETECTION, 3);

        assertEquals("impact", mapper.map(decode(real), "TLTK01").getEvents().getFirst().getEventType());
        AssetTrackingData data = mapper.map(decode(partial), "TLTK01");
        assertNull(data.getEvents());
        assertEquals(3L, io(data).get("crash_detection"), "the trace type is kept");
    }

    @Test
    void dallasTemperaturesAreSigned() {
        var record = new AvlPacketEncoder.Record(START).position(-33.4, -70.6, 0, 0, 9, 0)
                .io2(72, -55 & 0xFFFF).io2(73, 215);

        Map<String, Object> io = io(mapper.map(decode(record), "TLTK01"));
        assertEquals(-5.5, (Double) io.get("dallas_temp_1_c"), 1e-9);
        assertEquals(21.5, (Double) io.get("dallas_temp_2_c"), 1e-9);
    }

    @Test
    void lastKnownPositionIsKeptWithoutCurrentFix() {
        var noFix = new AvlPacketEncoder.Record(START).io1(IGNITION, 1).io1(GNSS_STATUS, 2)
                .position(-33.4, -70.6, 0, 0, 0, 0);
        AssetTrackingData data = mapper.map(decode(noFix), "TLTK01");

        assertEquals(-33.4, data.getGps().getLatitude(), 1e-7);
        assertEquals(2L, io(data).get("gnss_status"));
        assertNull(new AvlRecordMapper("Teltonika", false).map(decode(noFix), "TLTK01").getGps(),
                "with publishLastKnownPosition=false a record without fix has no gps");
    }

    @Test
    void noGpsObjectWithoutAnyPosition() {
        var zeroPosition = new AvlPacketEncoder.Record(START).io1(IGNITION, 1);
        AssetTrackingData data = mapper.map(decode(zeroPosition), "TLTK01");

        assertNull(data.getGps());
        assertFalse(AvlRecordMapper.hasPosition(decode(zeroPosition)));
        assertTrue(data.getSensors().getEngineStatus(), "other data is kept");
    }

    @Test
    void absentIbuttonKeyIsNotSent() {
        var record = new AvlPacketEncoder.Record(START).io8(IBUTTON, 0);

        assertNull(mapper.map(decode(record), "TLTK01").getDriverInfo());
    }

    @Test
    void unnamedIdsAreKeptInTheIoMetric() {
        var record = new AvlPacketEncoder.Record(START).io2(113, 87).io8(ICCID_1, 0x3544C87AL)
                .ioBytes(385, new byte[] {1, 2, 3});
        Map<String, Object> io = io(mapper.map(decode(record), "TLTK01"));

        assertEquals(87L, io.get("io_113"));
        assertEquals("893700218", io.get("io_11"));
        assertEquals("010203", io.get("io_385"));
    }

    @Test
    void oneExtensionMetricPerRecordAndEveryMetricValidates() {
        for (AvlRecord avl : trip()) {
            List<MetricItem> items = mapper.map(avl, "TLTK01").getMetrics().getItems();
            assertEquals(1, items.stream().filter(i -> MetricRegistry.isExtensionKey(i.getK())).count(),
                    "tracking keeps one extension metric per asset and instant");
            for (MetricItem item : items) {
                assertTrue(MetricRegistry.validate(item).isValid(), item.getK() + ": " + MetricRegistry.validate(item));
                assertTrue(item.getK().matches(MetricItem.KEY_PATTERN), item.getK());
                assertEquals(avl.timestamp(), item.getTs().toInstant(), "tracking requires ts: " + item.getK());
            }
        }
    }

    @Test
    void jsonUsesTheFieldNamesOfAssetTrack() throws Exception {
        JsonNode json = JSON.readTree(JSON.writeValueAsString(mapper.map(trip().getFirst(), "TLTK01")));

        assertEquals("TLTK01", json.get("asset_id").asText());
        assertTrue(json.get("sensors").get("engine_status").isBoolean());
        assertEquals(152_340.0, json.get("sensors").get("odometer").get("total_distance").asDouble());
        assertEquals("0136A24F000000C7", json.get("driver_info").get("id_button").asText());
        assertEquals("Teltonika", json.get("telecom").get("gps_provider").asText());
        assertEquals("miot.metrics@1.0", json.get("metrics").get("schema").asText());
        assertNotNull(json.get("gps").get("latitude"));
    }

    private static List<AvlRecord> trip() {
        byte[] packet = AvlPacketEncoder.codec8Extended(Fmb920Emulator.santiagoTrip(START, Duration.ofSeconds(30)));
        return CodecParser.parse(Arrays.copyOfRange(packet, 8, packet.length - 4)).records();
    }

    private static AvlRecord decode(AvlPacketEncoder.Record record) {
        byte[] packet = AvlPacketEncoder.codec8Extended(List.of(record));
        return CodecParser.parse(Arrays.copyOfRange(packet, 8, packet.length - 4)).records().getFirst();
    }

    private static AvlRecord withoutEventTrigger(AvlRecord r) {
        return new AvlRecord(r.timestamp(), r.priority(), r.longitude(), r.latitude(), r.altitude(),
                r.angle(), r.satellites(), r.speed(), 0, r.io());
    }

    private static Map<String, Object> metrics(AssetTrackingData data) {
        return data.getMetrics().getItems().stream().collect(Collectors.toMap(MetricItem::getK, MetricItem::getV));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> io(AssetTrackingData data) {
        return (Map<String, Object>) metrics(data).get(AvlRecordMapper.IO_METRIC);
    }
}
