package com.microboxlabs.miot.teltonika.tools;

import com.microboxlabs.miot.teltonika.protocol.Crc16;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds Codec 8 Extended packets the way a Teltonika FMB device does. Test and emulator use only.
 */
public final class AvlPacketEncoder {

    /** One record to encode. I/O values are grouped by their byte width. */
    public static final class Record {
        final Instant timestamp;
        int priority;
        double latitude;
        double longitude;
        int altitude;
        int angle;
        int satellites;
        int speed;
        int eventIoId;
        final Map<Integer, byte[]> io = new LinkedHashMap<>();

        public Record(Instant timestamp) {
            this.timestamp = timestamp;
        }

        public Record position(double latitude, double longitude, int altitude, int angle,
                int satellites, int speed) {
            this.latitude = latitude;
            this.longitude = longitude;
            this.altitude = altitude;
            this.angle = angle;
            this.satellites = satellites;
            this.speed = speed;
            return this;
        }

        public Record priority(int priority) {
            this.priority = priority;
            return this;
        }

        public Record event(int avlId) {
            this.eventIoId = avlId;
            return this;
        }

        public Record io1(int id, long value) {
            return io(id, value, 1);
        }

        public Record io2(int id, long value) {
            return io(id, value, 2);
        }

        public Record io4(int id, long value) {
            return io(id, value, 4);
        }

        public Record io8(int id, long value) {
            return io(id, value, 8);
        }

        public Record ioBytes(int id, byte[] value) {
            io.put(id, value.clone());
            return this;
        }

        private Record io(int id, long value, int width) {
            byte[] bytes = new byte[width];
            for (int i = width - 1; i >= 0; i--) {
                bytes[i] = (byte) value;
                value >>= 8;
            }
            io.put(id, bytes);
            return this;
        }
    }

    private AvlPacketEncoder() {
    }

    /** IMEI frame: 2-byte length and the IMEI in ASCII. */
    public static byte[] imei(String imei) {
        byte[] digits = imei.getBytes(StandardCharsets.US_ASCII);
        return ByteBuffer.allocate(2 + digits.length).putShort((short) digits.length).put(digits).array();
    }

    /** Complete TCP packet: preamble, length, Codec 8E data field and CRC-16. */
    public static byte[] codec8Extended(List<Record> records) {
        byte[] data = dataField(records);
        return ByteBuffer.allocate(8 + data.length + 4)
                .putInt(0)
                .putInt(data.length)
                .put(data)
                .putInt(Crc16.compute(data))
                .array();
    }

    /** A Codec 16 packet with a valid CRC: the receiver does not support it and must quarantine it. */
    public static byte[] unsupportedCodec() {
        byte[] data = {0x10, 0x01, 0, 0, 0, 0, 0x01};
        return ByteBuffer.allocate(8 + data.length + 4).putInt(0).putInt(data.length).put(data)
                .putInt(Crc16.compute(data)).array();
    }

    /** Same packet with the CRC altered, to test rejection. */
    public static byte[] withBadCrc(byte[] packet) {
        byte[] copy = packet.clone();
        copy[copy.length - 1] ^= 0x5A;
        return copy;
    }

    public static byte[] dataField(List<Record> records) {
        var out = new ByteArrayOutputStream();
        out.write(0x8E);
        out.write(records.size());
        for (Record r : records) {
            writeRecord(out, r);
        }
        out.write(records.size());
        return out.toByteArray();
    }

    private static void writeRecord(ByteArrayOutputStream out, Record r) {
        Map<Integer, List<Map.Entry<Integer, byte[]>>> byWidth = new LinkedHashMap<>();
        for (int width : new int[] {1, 2, 4, 8, 0}) {
            byWidth.put(width, new ArrayList<>());
        }
        for (var e : r.io.entrySet()) {
            int len = e.getValue().length;
            byWidth.get(len == 1 || len == 2 || len == 4 || len == 8 ? len : 0).add(e);
        }
        var buf = ByteBuffer.allocate(64 + r.io.values().stream().mapToInt(v -> v.length + 6).sum());
        buf.putLong(r.timestamp.toEpochMilli());
        buf.put((byte) r.priority);
        buf.putInt((int) Math.round(r.longitude * 10_000_000d));
        buf.putInt((int) Math.round(r.latitude * 10_000_000d));
        buf.putShort((short) r.altitude);
        buf.putShort((short) r.angle);
        buf.put((byte) r.satellites);
        buf.putShort((short) r.speed);
        buf.putShort((short) r.eventIoId);
        buf.putShort((short) r.io.size());
        for (int width : new int[] {1, 2, 4, 8}) {
            var group = byWidth.get(width);
            buf.putShort((short) group.size());
            for (var e : group) {
                buf.putShort(e.getKey().shortValue());
                buf.put(e.getValue());
            }
        }
        var variable = byWidth.get(0);
        buf.putShort((short) variable.size());
        for (var e : variable) {
            buf.putShort(e.getKey().shortValue());
            buf.putShort((short) e.getValue().length);
            buf.put(e.getValue());
        }
        out.write(buf.array(), 0, buf.position());
    }
}
