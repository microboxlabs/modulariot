package com.microboxlabs.miot.teltonika.protocol;

import java.util.Arrays;
import java.util.HexFormat;

/**
 * One I/O property of an AVL record: its AVL ID and the raw big-endian value bytes.
 */
public record IoElement(int id, byte[] value) {

    private static final HexFormat HEX = HexFormat.of().withUpperCase();

    public IoElement {
        value = value.clone();
    }

    @Override
    public byte[] value() {
        return value.clone();
    }

    public int length() {
        return value.length;
    }

    /** Unsigned value. Only for elements of up to 7 bytes, or 8-byte values below 2^63. */
    public long unsigned() {
        long result = 0;
        for (byte b : value) {
            result = (result << 8) | (b & 0xFF);
        }
        return result;
    }

    /** Two's complement value of the element width (1, 2, 4 or 8 bytes). */
    public long signed() {
        return switch (value.length) {
            case 1 -> value[0];
            case 2 -> (short) unsigned();
            case 4 -> (int) unsigned();
            default -> unsigned();
        };
    }

    /** Unsigned decimal text, safe for 8-byte values. */
    public String unsignedText() {
        return value.length == 8 ? Long.toUnsignedString(unsigned()) : Long.toString(unsigned());
    }

    public String hex() {
        return HEX.formatHex(value);
    }

    public boolean isZero() {
        for (byte b : value) {
            if (b != 0) {
                return false;
            }
        }
        return true;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof IoElement other && id == other.id && Arrays.equals(value, other.value);
    }

    @Override
    public int hashCode() {
        return 31 * id + Arrays.hashCode(value);
    }

    @Override
    public String toString() {
        return "IoElement[id=" + id + ", value=" + hex() + "]";
    }
}
