package com.microboxlabs.miot.teltonika.protocol;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.teltonika.server.MqttReceiver;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder.Record;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import org.junit.jupiter.api.Test;

/** UDP datagrams, Codec JSON and the payloads a Teltonika device publishes over MQTT. */
class ChannelsTest {

    private static final String IMEI = "352093086403655";
    private static final Instant T = Instant.parse("2026-11-16T12:00:00Z");

    @Test
    void udpDatagramRoundTripAndAck() {
        byte[] data = AvlPacketEncoder.dataField(List.of(new Record(T).position(-33.45, -70.66, 570, 90, 9, 40)));
        var d = UdpChannel.parse(UdpChannel.encode(0xCAFE, 7, IMEI, data));
        assertEquals(0xCAFE, d.packetId());
        assertEquals(7, d.avlPacketId());
        assertEquals(IMEI, d.imei());
        assertEquals(1, d.declaredCount());
        assertEquals(-33.45, CodecParser.parse(d.avlData()).records().getFirst().latitude(), 1e-7);
        assertArrayEquals(HexFormat.of().parseHex("0005CAFE010701"), UdpChannel.ack(0xCAFE, 7, 1));
    }

    @Test
    void wikiUdpExampleIsAccepted() {
        // Teltonika_Data_Sending_Protocols, UDP channel: Codec 8 Extended example with 1 record.
        byte[] datagram = UdpChannel.encode(0xCAFE, 1, IMEI, HexFormat.of().parseHex(
                "8E010000016B4F815B30010000000000000000000000000000000105000100010000000000000000000001"));
        assertEquals(1, UdpChannel.parse(datagram).declaredCount());
        assertThrows(ProtocolException.class, () -> UdpChannel.parse(new byte[] {0, 9, 1}));
    }

    @Test
    void codecJsonOfTheWikiAndOfTheField() {
        var wiki = CodecJson.parse(("{\"reported\":{\"tcxn\":{\"connection_status\":2},\"ts\":1510641143000,\"pr\":0,"
                + "\"lnglat\":\"-70.660000,-33.450000\",\"alt\":570,\"ang\":90,\"sat\":9,\"sp\":40,\"evt\":0,"
                + "\"21\":3,\"66\":13909,\"239\":1}}").getBytes(StandardCharsets.UTF_8)).records().getFirst();
        assertEquals(-33.45, wiki.latitude(), 1e-9, "lnglat: longitude first");
        assertEquals(-70.66, wiki.longitude(), 1e-9);
        assertEquals(13909, wiki.ioElement(66).unsigned());
        assertEquals(1, wiki.ioElement(239).unsigned());

        var field = CodecJson.parse(("{\"state\":{\"reported\":{\"ts\":1720354973000,\"pr\":0,"
                + "\"latlng\":\"-33.45,-70.66\",\"alt\":132,\"ang\":189,\"sat\":7,\"sp\":0,\"evt\":240,"
                + "\"240\":0,\"72\":-55}}}").getBytes(StandardCharsets.UTF_8)).records().getFirst();
        assertEquals(-33.45, field.latitude(), 1e-9, "latlng: latitude first");
        assertEquals(240, field.eventIoId());
        assertEquals(-55, field.ioElement(72).signed(), "signed values survive");
    }

    @Test
    void mqttPayloadsAreRecordsOrCommandAnswers() {
        byte[] json = "{\"state\":{\"reported\":{\"ts\":1720354973000,\"latlng\":\"-33.45,-70.66\"}}}"
                .getBytes(StandardCharsets.UTF_8);
        assertNull(MqttReceiver.commandAnswer(json));
        assertEquals(1, MqttReceiver.decode(json).recordCount());

        assertEquals("Param ID:2015 Value:424242", MqttReceiver.commandAnswer(
                "{\"RSP\":\"Param ID:2015 Value:424242\"}".getBytes(StandardCharsets.UTF_8)));

        byte[] tcp = AvlPacketEncoder.codec8Extended(List.of(new Record(T).position(-33.45, -70.66, 0, 0, 5, 0)));
        assertEquals(1, MqttReceiver.decode(tcp).recordCount(), "Codec 8E with TCP framing");
        byte[] bare = AvlPacketEncoder.dataField(List.of(new Record(T).position(-33.45, -70.66, 0, 0, 5, 0)));
        assertEquals(1, MqttReceiver.decode(bare).recordCount(), "bare AVL data");
        assertNull(MqttReceiver.commandAnswer(bare));
    }

    @Test
    void aMalformedMqttPayloadIsRejectedByTheParserNotByAnIndexError() {
        byte[] inconsistent = {0, 0, 0, 0, 0, 0, 0, 9, 8, 1, 0, 0, 0};
        assertEquals(inconsistent.length, MqttReceiver.avlData(inconsistent).length,
                "framing whose length does not match: passed as is");
        assertThrows(ProtocolException.class, () -> MqttReceiver.decode(inconsistent));
        byte[] oneByte = {0, 0, 0, 0, 0, 0, 0, 1, 8, 0, 0, 0, 0};
        assertEquals(1, MqttReceiver.avlData(oneByte).length);
        assertThrows(ProtocolException.class, () -> MqttReceiver.decode(oneByte),
                "too short: a protocol error (quarantine and PUBACK), not an index error");
        assertTrue(MqttReceiver.clientId("rx-{host}").startsWith("rx-") && !MqttReceiver.clientId("rx-{host}")
                .contains("{host}"), "one client id per replica");
        assertEquals("fixed", MqttReceiver.clientId("fixed"));
    }
}
