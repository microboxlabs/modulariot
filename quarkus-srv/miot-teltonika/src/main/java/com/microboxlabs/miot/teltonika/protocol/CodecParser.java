package com.microboxlabs.miot.teltonika.protocol;

import java.nio.BufferUnderflowException;
import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Decodes the AVL data array of Codec 8 and Codec 8 Extended packets.
 *
 * <p>Input is the "data field": from the Codec ID to the second record count, as delimited by
 * the packet length. Specification:
 * https://wiki.teltonika-gps.com/view/Teltonika_Data_Sending_Protocols
 */
public final class CodecParser {

    public static final int CODEC_8 = 0x08;
    public static final int CODEC_8_EXTENDED = 0x8E;

    private static final double COORDINATE_PRECISION = 10_000_000d;
    private static final int[] FIXED_WIDTHS = {1, 2, 4, 8};

    private CodecParser() {
    }

    public static AvlPacket parse(byte[] dataField) {
        ByteBuffer buf = ByteBuffer.wrap(dataField);
        try {
            int codecId = buf.get() & 0xFF;
            if (codecId != CODEC_8 && codecId != CODEC_8_EXTENDED) {
                throw new ProtocolException("Unsupported codec 0x%02X".formatted(codecId));
            }
            boolean extended = codecId == CODEC_8_EXTENDED;
            int count = buf.get() & 0xFF;
            List<AvlRecord> records = new ArrayList<>(count);
            for (int i = 0; i < count; i++) {
                records.add(readRecord(buf, extended));
            }
            int countAtEnd = buf.get() & 0xFF;
            if (countAtEnd != count) {
                throw new ProtocolException("Record counts differ: %d at start, %d at end"
                        .formatted(count, countAtEnd));
            }
            if (buf.hasRemaining()) {
                throw new ProtocolException("%d unexpected bytes after the records"
                        .formatted(buf.remaining()));
            }
            return new AvlPacket(codecId, records);
        } catch (BufferUnderflowException e) {
            throw new ProtocolException("Packet ends before its declared content", e);
        }
    }

    private static AvlRecord readRecord(ByteBuffer buf, boolean extended) {
        Instant timestamp = Instant.ofEpochMilli(buf.getLong());
        int priority = buf.get() & 0xFF;
        double longitude = buf.getInt() / COORDINATE_PRECISION;
        double latitude = buf.getInt() / COORDINATE_PRECISION;
        int altitude = buf.getShort();
        int angle = buf.getShort() & 0xFFFF;
        int satellites = buf.get() & 0xFF;
        int speed = buf.getShort() & 0xFFFF;

        int eventIoId = readCount(buf, extended);
        int declaredTotal = readCount(buf, extended);
        Map<Integer, IoElement> io = new LinkedHashMap<>();
        for (int width : FIXED_WIDTHS) {
            int n = readCount(buf, extended);
            for (int i = 0; i < n; i++) {
                int id = readCount(buf, extended);
                byte[] value = new byte[width];
                buf.get(value);
                io.put(id, new IoElement(id, value));
            }
        }
        if (extended) {
            int n = buf.getShort() & 0xFFFF;
            for (int i = 0; i < n; i++) {
                int id = buf.getShort() & 0xFFFF;
                int length = buf.getShort() & 0xFFFF;
                byte[] value = new byte[length];
                buf.get(value);
                io.put(id, new IoElement(id, value));
            }
        }
        if (io.size() != declaredTotal) {
            throw new ProtocolException("Record declares %d I/O elements but carries %d"
                    .formatted(declaredTotal, io.size()));
        }
        return new AvlRecord(timestamp, priority, longitude, latitude, altitude, angle,
                satellites, speed, eventIoId, io);
    }

    /** Event ID, totals, per-width counts and AVL IDs: 1 byte in Codec 8, 2 bytes in Codec 8E. */
    private static int readCount(ByteBuffer buf, boolean extended) {
        return extended ? buf.getShort() & 0xFFFF : buf.get() & 0xFF;
    }
}
