package com.microboxlabs.miot.teltonika.protocol;

import java.nio.BufferUnderflowException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Teltonika UDP channel: each datagram carries its own header and the device IMEI, and the server
 * answers each one with an acknowledgment. No CRC (UDP checks the datagram).
 *
 * <pre>
 * datagram: length(2) packetId(2) 0x01(1) avlPacketId(1) imeiLength(2) imei avlData
 * ack:      0x0005 packetId(2) 0x01(1) avlPacketId(1) acceptedRecords(1)
 * </pre>
 *
 * {@code avlData} is the same data field as in TCP (codec ID, count, records, count).
 * https://wiki.teltonika-gps.com/view/Teltonika_Data_Sending_Protocols#UDP_channel_protocol
 */
public final class UdpChannel {

    /** One decoded datagram. */
    public record Datagram(int packetId, int avlPacketId, String imei, byte[] avlData) {

        public Datagram {
            avlData = avlData.clone();
        }

        @Override
        public byte[] avlData() {
            return avlData.clone();
        }

        /** Records the device declared (second byte of the data field), for quarantine acks. */
        public int declaredCount() {
            return avlData.length > 1 ? avlData[1] & 0xFF : 0;
        }
    }

    private UdpChannel() {
    }

    public static Datagram parse(byte[] datagram) {
        ByteBuffer buf = ByteBuffer.wrap(datagram);
        try {
            int length = buf.getShort() & 0xFFFF;
            if (length != datagram.length - 2) {
                throw new ProtocolException("UDP length %d does not match %d bytes".formatted(length,
                        datagram.length - 2));
            }
            int packetId = buf.getShort() & 0xFFFF;
            buf.get(); // not usable byte (0x01)
            int avlPacketId = buf.get() & 0xFF;
            int imeiLength = buf.getShort() & 0xFFFF;
            if (imeiLength < 1 || imeiLength > 32) {
                throw new ProtocolException("UDP IMEI length " + imeiLength);
            }
            byte[] imei = new byte[imeiLength];
            buf.get(imei);
            String id = new String(imei, StandardCharsets.US_ASCII);
            if (!id.matches("^[0-9]{15}$")) {
                throw new ProtocolException("UDP IMEI is not 15 digits");
            }
            return new Datagram(packetId, avlPacketId, id, Arrays.copyOfRange(datagram, buf.position(),
                    datagram.length));
        } catch (BufferUnderflowException e) {
            throw new ProtocolException("UDP datagram ends before its header", e);
        }
    }

    public static byte[] ack(int packetId, int avlPacketId, int accepted) {
        return ByteBuffer.allocate(7).putShort((short) 5).putShort((short) packetId).put((byte) 1)
                .put((byte) avlPacketId).put((byte) accepted).array();
    }

    /** The datagram a device sends (tests and the emulator). */
    public static byte[] encode(int packetId, int avlPacketId, String imei, byte[] avlData) {
        byte[] id = imei.getBytes(StandardCharsets.US_ASCII);
        int length = 2 + 1 + 1 + 2 + id.length + avlData.length;
        return ByteBuffer.allocate(2 + length).putShort((short) length).putShort((short) packetId).put((byte) 1)
                .put((byte) avlPacketId).putShort((short) id.length).put(id).put(avlData).array();
    }
}
