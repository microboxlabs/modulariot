package com.microboxlabs.miot.teltonika.monitor;

import java.time.OffsetDateTime;

/**
 * One packet kept in {@code miot_teltonika.packet_log}: the raw bytes as received and why it was kept.
 *
 * @param outcome {@code published} (only during a capture), {@code quarantined}, {@code crc_error},
 *                {@code partial} (some records not published) or {@code command_response}
 */
public record PacketLogEntry(String imei, String tenantCode, OffsetDateTime receivedAt, String remoteAddress,
        String outcome, String reason, Integer codecId, Integer recordCount, byte[] packet, String format) {

    /** Full Teltonika TCP AVL packet (preamble, length, data, CRC). */
    public static final String TELTONIKA_TCP = "teltonika_tcp";
    /** Teltonika UDP datagram (channel header, IMEI, AVL data). */
    public static final String TELTONIKA_UDP = "teltonika_udp";
    /** Teltonika MQTT message: Codec JSON or the AVL data of Codec 8/8E. */
    public static final String TELTONIKA_MQTT = "teltonika_mqtt";
    /** A position Traccar forwarded, as JSON. */
    public static final String TRACCAR_JSON = "traccar_json";

    /** A TCP packet. */
    public PacketLogEntry(String imei, String tenantCode, OffsetDateTime receivedAt, String remoteAddress,
            String outcome, String reason, Integer codecId, Integer recordCount, byte[] packet) {
        this(imei, tenantCode, receivedAt, remoteAddress, outcome, reason, codecId, recordCount, packet, TELTONIKA_TCP);
    }

    public static final String PUBLISHED = "published";
    public static final String QUARANTINED = "quarantined";
    public static final String CRC_ERROR = "crc_error";
    public static final String PARTIAL = "partial";
    public static final String COMMAND_RESPONSE = "command_response";
    public static final String PENDING_ACTIVATION = "pending_activation";
    public static final String REPLAYED = "replayed";
}
