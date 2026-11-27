package com.microboxlabs.miot.teltonika.protocol;

/**
 * CRC-16/IBM (also known as CRC-16/ARC): polynomial 0xA001 reflected, initial value 0.
 * Teltonika computes it from the Codec ID to the second record count.
 */
public final class Crc16 {

    private Crc16() {
    }

    public static int compute(byte[] data, int offset, int length) {
        int crc = 0;
        for (int i = offset; i < offset + length; i++) {
            crc ^= data[i] & 0xFF;
            for (int bit = 0; bit < 8; bit++) {
                crc = (crc & 1) != 0 ? (crc >>> 1) ^ 0xA001 : crc >>> 1;
            }
        }
        return crc & 0xFFFF;
    }

    public static int compute(byte[] data) {
        return compute(data, 0, data.length);
    }
}
