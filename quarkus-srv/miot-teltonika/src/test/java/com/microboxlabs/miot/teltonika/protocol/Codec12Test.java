package com.microboxlabs.miot.teltonika.protocol;

import static com.microboxlabs.miot.teltonika.tools.Fmb920Emulator.hex;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.teltonika.protocol.TcpFrameDecoder.DataFrame;
import com.microboxlabs.miot.teltonika.tools.AvlPacketEncoder;
import org.junit.jupiter.api.Test;

/** The Codec 12 examples of the Teltonika wiki, byte for byte. */
class Codec12Test {

    @Test
    void wikiGetinfoCommand() {
        assertArrayEquals(hex("000000000000000F0C010500000007676574696E666F0100004312"),
                Codec12.encodeCommand("getinfo"));
    }

    @Test
    void wikiGetioCommand() {
        assertArrayEquals(hex("000000000000000D0C010500000005676574696F01000000CB"), Codec12.encodeCommand("getio"));
    }

    @Test
    void wikiGetioResponse() {
        DataFrame frame = frame(hex("00000000000000370C01060000002F4449313A31204449323A30204449333A302041494E313A30"
                + "2041494E323A313639323420444F313A3020444F323A3101000066E3"));

        assertTrue(frame.crcValid());
        assertTrue(Codec12.isCodec12(frame.dataField()));
        assertEquals("DI1:1 DI2:0 DI3:0 AIN1:0 AIN2:16924 DO1:0 DO2:1", Codec12.decodeResponse(frame.dataField()));
    }

    @Test
    void responseRoundTrip() {
        DataFrame frame = frame(Codec12.encodeResponse("GPS:1 Sat:11"));

        assertTrue(frame.crcValid());
        assertEquals("GPS:1 Sat:11", Codec12.decodeResponse(frame.dataField()));
    }

    @Test
    void refusesEmptyAndOversizedCommands() {
        assertThrows(IllegalArgumentException.class, () -> Codec12.encodeCommand(" "));
        assertThrows(IllegalArgumentException.class, () -> Codec12.encodeCommand("x".repeat(513)));
    }

    @Test
    void aCommandIsNotAResponse() {
        DataFrame frame = frame(Codec12.encodeCommand("getinfo"));

        assertThrows(ProtocolException.class, () -> Codec12.decodeResponse(frame.dataField()));
    }

    private static DataFrame frame(byte[] packet) {
        var decoder = new TcpFrameDecoder();
        decoder.append(AvlPacketEncoder.imei("356307042441013"));
        decoder.next();
        decoder.append(packet);
        return (DataFrame) decoder.next();
    }
}
