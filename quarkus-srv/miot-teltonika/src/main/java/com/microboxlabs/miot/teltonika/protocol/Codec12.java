package com.microboxlabs.miot.teltonika.protocol;

import java.nio.BufferUnderflowException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

/**
 * Codec 12: text commands from the server to the device over the open TCP session, and the device's
 * text response. Same framing as AVL packets (preamble, length, data field, CRC-16).
 * Specification: https://wiki.teltonika-gps.com/view/Teltonika_Data_Sending_Protocols#Codec_12
 *
 * <p>A command may be sent only after the device's last data packet was acknowledged; the session
 * takes care of that.
 */
public final class Codec12 {

    public static final int CODEC_ID = 0x0C;
    private static final int TYPE_COMMAND = 0x05;
    private static final int TYPE_RESPONSE = 0x06;
    /** Teltonika commands are short; longer ones are refused before reaching the device. */
    public static final int MAX_COMMAND_LENGTH = 512;

    private Codec12() {
    }

    /** Complete TCP packet carrying {@code command}, e.g. {@code getinfo}. */
    public static byte[] encodeCommand(String command) {
        if (command == null || command.isBlank()) {
            throw new IllegalArgumentException("command is required");
        }
        byte[] text = command.getBytes(StandardCharsets.US_ASCII);
        if (text.length > MAX_COMMAND_LENGTH) {
            throw new IllegalArgumentException("command is longer than " + MAX_COMMAND_LENGTH + " characters");
        }
        byte[] data = ByteBuffer.allocate(8 + text.length)
                .put((byte) CODEC_ID)
                .put((byte) 1)
                .put((byte) TYPE_COMMAND)
                .putInt(text.length)
                .put(text)
                .put((byte) 1)
                .array();
        return ByteBuffer.allocate(8 + data.length + 4)
                .putInt(0)
                .putInt(data.length)
                .put(data)
                .putInt(Crc16.compute(data))
                .array();
    }

    /** Whether a data field (from the Codec ID) is a Codec 12 message. */
    public static boolean isCodec12(byte[] dataField) {
        return dataField.length > 0 && (dataField[0] & 0xFF) == CODEC_ID;
    }

    /** The device's response text from a Codec 12 data field. */
    public static String decodeResponse(byte[] dataField) {
        ByteBuffer buf = ByteBuffer.wrap(dataField);
        try {
            int codec = buf.get() & 0xFF;
            if (codec != CODEC_ID) {
                throw new ProtocolException("Not a Codec 12 message: 0x%02X".formatted(codec));
            }
            buf.get(); // quantity 1, ignored by the protocol
            int type = buf.get() & 0xFF;
            if (type != TYPE_RESPONSE) {
                throw new ProtocolException("Codec 12 message type 0x%02X is not a response".formatted(type));
            }
            int size = buf.getInt();
            if (size < 0 || size > buf.remaining() - 1) {
                throw new ProtocolException("Codec 12 response size " + size + " exceeds the packet");
            }
            byte[] text = new byte[size];
            buf.get(text);
            buf.get(); // quantity 2
            if (buf.hasRemaining()) {
                throw new ProtocolException(buf.remaining() + " unexpected bytes after the Codec 12 response");
            }
            return new String(text, StandardCharsets.US_ASCII);
        } catch (BufferUnderflowException e) {
            throw new ProtocolException("Codec 12 response ends before its declared content", e);
        }
    }

    /** Device-side encoding of a response, for the emulator and tests. */
    public static byte[] encodeResponse(String response) {
        byte[] text = response.getBytes(StandardCharsets.US_ASCII);
        byte[] data = ByteBuffer.allocate(8 + text.length)
                .put((byte) CODEC_ID).put((byte) 1).put((byte) TYPE_RESPONSE)
                .putInt(text.length).put(text).put((byte) 1)
                .array();
        return ByteBuffer.allocate(8 + data.length + 4)
                .putInt(0).putInt(data.length).put(data).putInt(Crc16.compute(data))
                .array();
    }

    /** The command text of a server-side Codec 12 data field, for the emulator and tests. */
    public static String decodeCommand(byte[] dataField) {
        ByteBuffer buf = ByteBuffer.wrap(dataField);
        buf.get();
        buf.get();
        int type = buf.get() & 0xFF;
        if (type != TYPE_COMMAND) {
            throw new ProtocolException("Codec 12 message type 0x%02X is not a command".formatted(type));
        }
        byte[] text = new byte[buf.getInt()];
        buf.get(text);
        return new String(text, StandardCharsets.US_ASCII);
    }
}
