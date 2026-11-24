package com.microboxlabs.miot.teltonika.protocol;

import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.WIKI_CODEC8E_ONE_RECORD;
import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.WIKI_CODEC8_ONE_RECORD;
import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.WIKI_CODEC8_TWO_RECORDS;
import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.hex;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.teltonika.protocol.TcpFrameDecoder.DataFrame;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The three TCP examples of https://wiki.teltonika-gps.com/view/Teltonika_Data_Sending_Protocols
 * with the values the wiki gives for each field.
 */
class CodecParserTest {

    @Test
    void wikiCodec8OneRecord() {
        AvlPacket packet = CodecParser.parse(dataField(WIKI_CODEC8_ONE_RECORD));

        assertEquals(CodecParser.CODEC_8, packet.codecId());
        assertEquals(1, packet.recordCount());
        AvlRecord r = packet.records().getFirst();
        assertEquals(Instant.parse("2019-06-10T10:04:46Z"), r.timestamp());
        assertEquals(1, r.priority());
        assertEquals(1, r.eventIoId());
        assertEquals(5, r.io().size());
        assertEquals(3, r.ioElement(21).unsigned(), "GSM signal");
        assertEquals(1, r.ioElement(1).unsigned(), "DIN1");
        assertEquals(0x5E0F, r.ioElement(66).unsigned(), "external voltage");
        assertEquals(0x601A, r.ioElement(241).unsigned(), "active GSM operator");
        assertTrue(r.ioElement(78).isZero(), "iButton");
    }

    @Test
    void wikiCodec8TwoRecords() {
        AvlPacket packet = CodecParser.parse(dataField(WIKI_CODEC8_TWO_RECORDS));

        assertEquals(2, packet.recordCount());
        assertEquals(Instant.parse("2019-06-10T10:01:01Z"), packet.records().get(0).timestamp());
        assertEquals(Instant.parse("2019-06-10T10:01:19Z"), packet.records().get(1).timestamp());
        assertEquals(0, packet.records().get(0).ioElement(1).unsigned());
        assertEquals(1, packet.records().get(1).ioElement(1).unsigned());
    }

    @Test
    void wikiCodec8ExtendedOneRecord() {
        AvlPacket packet = CodecParser.parse(dataField(WIKI_CODEC8E_ONE_RECORD));

        assertEquals(CodecParser.CODEC_8_EXTENDED, packet.codecId());
        AvlRecord r = packet.records().getFirst();
        assertEquals(Instant.parse("2019-06-10T11:36:32Z"), r.timestamp());
        assertEquals(1, r.eventIoId());
        assertEquals(1, r.ioElement(1).unsigned(), "DIN1");
        assertEquals(0x1D, r.ioElement(17).signed(), "axis X");
        assertEquals(22_949_000, r.ioElement(16).unsigned(), "total odometer, meters");
        assertEquals("000000003544C87A", r.ioElement(11).hex(), "ICCID1");
        assertEquals("000000001DD7E06A", r.ioElement(14).hex(), "ICCID2");
    }

    @Test
    void southernAndWesternCoordinatesAreNegative() {
        var record = new AvlPacketEncoder.Record(Instant.parse("2026-11-16T12:00:00Z"))
                .position(-33.4489, -70.6693, 570, 145, 11, 52);
        AvlRecord r = parseEncoded(List.of(record)).records().getFirst();

        assertEquals(-33.4489, r.latitude(), 1e-7);
        assertEquals(-70.6693, r.longitude(), 1e-7);
        assertEquals(52, r.speed());
        assertEquals(145, r.angle());
    }

    @Test
    void variableLengthElementsOfCodec8Extended() {
        var record = new AvlPacketEncoder.Record(Instant.parse("2026-11-16T12:00:00Z"))
                .ioBytes(385, new byte[] {1, 2, 3, 4, 5, 6, 7, 8, 9, 10});
        AvlRecord r = parseEncoded(List.of(record)).records().getFirst();

        assertEquals("0102030405060708090A", r.ioElement(385).hex());
    }

    @Test
    void rejectsUnsupportedCodec() {
        byte[] data = dataField(WIKI_CODEC8_ONE_RECORD);
        data[0] = 0x10;
        assertThrows(ProtocolException.class, () -> CodecParser.parse(data));
    }

    @Test
    void rejectsDifferentRecordCounts() {
        byte[] data = dataField(WIKI_CODEC8_ONE_RECORD);
        data[data.length - 1] = 2;
        assertThrows(ProtocolException.class, () -> CodecParser.parse(data));
    }

    @Test
    void rejectsTruncatedData() {
        byte[] data = dataField(WIKI_CODEC8_ONE_RECORD);
        assertThrows(ProtocolException.class,
                () -> CodecParser.parse(Arrays.copyOf(data, data.length - 5)));
    }

    @Test
    void wikiCrcValuesMatch() {
        assertEquals(0xC7CF, Crc16.compute(dataField(WIKI_CODEC8_ONE_RECORD)));
        assertEquals(0x252C, Crc16.compute(dataField(WIKI_CODEC8_TWO_RECORDS)));
        assertEquals(0x2994, Crc16.compute(dataField(WIKI_CODEC8E_ONE_RECORD)));
    }

    private static AvlPacket parseEncoded(List<AvlPacketEncoder.Record> records) {
        byte[] packet = AvlPacketEncoder.codec8Extended(records);
        return CodecParser.parse(Arrays.copyOfRange(packet, 8, packet.length - 4));
    }

    /** Data field of a complete wiki packet: without preamble, length and CRC. */
    static byte[] dataField(String packetHex) {
        var decoder = new TcpFrameDecoder();
        decoder.append(AvlPacketEncoder.imei("356307042441013"));
        decoder.next();
        decoder.append(hex(packetHex));
        DataFrame frame = (DataFrame) decoder.next();
        assertTrue(frame.crcValid(), "wiki packet CRC");
        return frame.dataField();
    }
}
