package com.microboxlabs.miot.teltonika.protocol;

import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.WIKI_CODEC8E_ONE_RECORD;
import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.WIKI_CODEC8_ONE_RECORD;
import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.hex;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.teltonika.protocol.TcpFrameDecoder.DataFrame;
import com.microboxlabs.miot.teltonika.protocol.TcpFrameDecoder.ImeiFrame;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder;
import org.junit.jupiter.api.Test;

class TcpFrameDecoderTest {

    @Test
    void wikiImeiFrame() {
        var decoder = new TcpFrameDecoder();
        decoder.append(hex("000F333536333037303432343431303133"));

        assertEquals(new ImeiFrame("356307042441013"), decoder.next());
        assertNull(decoder.next());
    }

    @Test
    void frameDeliveredOneByteAtATime() {
        var decoder = loggedIn();
        byte[] packet = hex(WIKI_CODEC8_ONE_RECORD);
        for (int i = 0; i < packet.length - 1; i++) {
            decoder.append(new byte[] {packet[i]});
            assertNull(decoder.next(), "incomplete after " + (i + 1) + " bytes");
        }
        decoder.append(new byte[] {packet[packet.length - 1]});

        DataFrame frame = assertInstanceOf(DataFrame.class, decoder.next());
        assertTrue(frame.crcValid());
        assertEquals(0, decoder.pendingBytes());
    }

    @Test
    void twoFramesInOneDelivery() {
        var decoder = new TcpFrameDecoder();
        byte[] imei = AvlPacketEncoder.imei("356307042441013");
        byte[] first = hex(WIKI_CODEC8_ONE_RECORD);
        byte[] second = hex(WIKI_CODEC8E_ONE_RECORD);
        byte[] all = new byte[imei.length + first.length + second.length];
        System.arraycopy(imei, 0, all, 0, imei.length);
        System.arraycopy(first, 0, all, imei.length, first.length);
        System.arraycopy(second, 0, all, imei.length + first.length, second.length);
        decoder.append(all);

        assertInstanceOf(ImeiFrame.class, decoder.next());
        assertEquals(0x08, assertInstanceOf(DataFrame.class, decoder.next()).dataField()[0]);
        assertEquals((byte) 0x8E, assertInstanceOf(DataFrame.class, decoder.next()).dataField()[0]);
        assertNull(decoder.next());
    }

    @Test
    void badCrcIsReportedNotThrown() {
        var decoder = loggedIn();
        decoder.append(AvlPacketEncoder.withBadCrc(hex(WIKI_CODEC8_ONE_RECORD)));

        assertFalse(assertInstanceOf(DataFrame.class, decoder.next()).crcValid());
    }

    @Test
    void rejectsMissingPreamble() {
        var decoder = loggedIn();
        byte[] packet = hex(WIKI_CODEC8_ONE_RECORD);
        packet[0] = 1;
        decoder.append(packet);

        assertThrows(ProtocolException.class, decoder::next);
    }

    @Test
    void rejectsOversizedLength() {
        var decoder = loggedIn();
        decoder.append(hex("00000000" + "7FFFFFFF"));

        assertThrows(ProtocolException.class, decoder::next);
    }

    @Test
    void rejectsNonNumericImei() {
        var decoder = new TcpFrameDecoder();
        decoder.append(hex("0003414243"));

        assertThrows(ProtocolException.class, decoder::next);
    }

    private static TcpFrameDecoder loggedIn() {
        var decoder = new TcpFrameDecoder();
        decoder.append(AvlPacketEncoder.imei("356307042441013"));
        assertInstanceOf(ImeiFrame.class, decoder.next());
        return decoder;
    }
}
