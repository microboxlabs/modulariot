package com.microboxlabs.miot.teltonika.protocol;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Splits the TCP byte stream of one device connection into frames.
 *
 * <p>The first frame is the IMEI: 2-byte length followed by the IMEI as ASCII digits. Every
 * following frame is an AVL data packet: 4 zero bytes, 4-byte data length, data field, 4-byte
 * CRC-16 (upper two bytes zero). TCP may deliver a frame in pieces or several frames together;
 * {@link #append} accumulates bytes and {@link #next} returns one complete frame at a time.
 *
 * <p>Not thread-safe: one instance per connection, used from its event loop.
 */
public final class TcpFrameDecoder {

    /** Largest data field accepted. Teltonika FMB devices send at most 1280-byte packets. */
    public static final int MAX_DATA_LENGTH = 16 * 1024;
    private static final int MAX_IMEI_LENGTH = 17;
    private static final int PACKET_HEADER = 8;
    private static final int CRC_LENGTH = 4;

    /** A complete frame read from the stream. */
    public sealed interface Frame permits ImeiFrame, DataFrame {
    }

    public record ImeiFrame(String imei) implements Frame {
    }

    /**
     * An AVL data packet.
     *
     * @param dataField   bytes from the Codec ID to the second record count
     * @param crcValid    whether the received CRC-16 matches the data field
     * @param rawPacket   the whole packet as received, for logging
     */
    public record DataFrame(byte[] dataField, boolean crcValid, byte[] rawPacket) implements Frame {
    }

    private byte[] buffer = new byte[2048];
    private int start;
    private int end;
    private boolean imeiReceived;

    public void append(byte[] bytes) {
        int pending = end - start;
        if (pending + bytes.length > PACKET_HEADER + MAX_DATA_LENGTH + CRC_LENGTH) {
            throw new ProtocolException("More than %d bytes pending without a complete frame"
                    .formatted(PACKET_HEADER + MAX_DATA_LENGTH + CRC_LENGTH));
        }
        if (end + bytes.length > buffer.length) {
            byte[] grown = new byte[Math.max(buffer.length, pending + bytes.length) * 2];
            System.arraycopy(buffer, start, grown, 0, pending);
            buffer = grown;
            start = 0;
            end = pending;
        }
        System.arraycopy(bytes, 0, buffer, end, bytes.length);
        end += bytes.length;
    }

    /** The next complete frame, or {@code null} when more bytes are needed. */
    public Frame next() {
        Frame frame = imeiReceived ? nextDataFrame() : nextImeiFrame();
        if (start == end) {
            start = 0;
            end = 0;
        }
        return frame;
    }

    public int pendingBytes() {
        return end - start;
    }

    private Frame nextImeiFrame() {
        if (end - start < 2) {
            return null;
        }
        int length = ((buffer[start] & 0xFF) << 8) | (buffer[start + 1] & 0xFF);
        if (length == 0 || length > MAX_IMEI_LENGTH) {
            throw new ProtocolException("Invalid IMEI length " + length);
        }
        if (end - start < 2 + length) {
            return null;
        }
        String imei = new String(buffer, start + 2, length, StandardCharsets.US_ASCII);
        if (!imei.chars().allMatch(Character::isDigit)) {
            throw new ProtocolException("IMEI is not numeric");
        }
        start += 2 + length;
        imeiReceived = true;
        return new ImeiFrame(imei);
    }

    private Frame nextDataFrame() {
        if (end - start < PACKET_HEADER) {
            return null;
        }
        ByteBuffer header = ByteBuffer.wrap(buffer, start, PACKET_HEADER);
        if (header.getInt() != 0) {
            throw new ProtocolException("Packet does not start with the 4-byte zero preamble");
        }
        long dataLength = header.getInt() & 0xFFFFFFFFL;
        if (dataLength == 0 || dataLength > MAX_DATA_LENGTH) {
            throw new ProtocolException("Invalid data length " + dataLength);
        }
        int total = PACKET_HEADER + (int) dataLength + CRC_LENGTH;
        if (end - start < total) {
            return null;
        }
        int dataStart = start + PACKET_HEADER;
        byte[] dataField = Arrays.copyOfRange(buffer, dataStart, dataStart + (int) dataLength);
        int receivedCrc = ByteBuffer.wrap(buffer, dataStart + (int) dataLength, CRC_LENGTH).getInt();
        boolean crcValid = receivedCrc == Crc16.compute(dataField);
        byte[] raw = Arrays.copyOfRange(buffer, start, start + total);
        start += total;
        return new DataFrame(dataField, crcValid, raw);
    }
}
