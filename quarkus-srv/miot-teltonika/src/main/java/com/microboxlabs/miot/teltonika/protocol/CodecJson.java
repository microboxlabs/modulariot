package com.microboxlabs.miot.teltonika.protocol;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Teltonika Codec JSON, the payload FMB devices publish over MQTT ("Data Protocol: Codec JSON"):
 * one record per message, AWS shadow style.
 *
 * <pre>{"state":{"reported":{"ts":1720354973000,"pr":0,"latlng":"-33.45,-70.66","alt":132,"ang":189,
 *  "sat":7,"sp":0,"evt":240,"239":0,"240":0,"66":13434,...}}}</pre>
 *
 * Numbered keys are the same AVL IDs as Codec 8 Extended, so the record goes through the same
 * mapping. The wiki example writes {@code lnglat} (longitude first); devices observed in the field
 * send {@code latlng}: both are read. https://wiki.teltonika-gps.com/view/Codec_JSON
 */
public final class CodecJson {

    private static final ObjectMapper JSON = new ObjectMapper();

    private CodecJson() {
    }

    public static boolean looksLikeJson(byte[] payload) {
        for (byte b : payload) {
            if (!Character.isWhitespace(b)) {
                return b == '{';
            }
        }
        return false;
    }

    public static AvlPacket parse(byte[] payload) {
        JsonNode root;
        try {
            root = JSON.readTree(payload);
        } catch (IOException e) {
            throw new ProtocolException("Codec JSON is not valid JSON: " + e.getMessage());
        }
        JsonNode r = root.path("state").path("reported");
        if (!r.isObject()) {
            r = root.path("reported");
        }
        if (!r.isObject() || !r.has("ts")) {
            throw new ProtocolException("Codec JSON without state.reported.ts");
        }
        double lat = 0;
        double lng = 0;
        if (r.hasNonNull("latlng")) {
            double[] p = pair(r.get("latlng").asText());
            lat = p[0];
            lng = p[1];
        } else if (r.hasNonNull("lnglat")) {
            double[] p = pair(r.get("lnglat").asText());
            lng = p[0];
            lat = p[1];
        }
        Map<Integer, IoElement> io = new LinkedHashMap<>();
        for (Iterator<Map.Entry<String, JsonNode>> it = r.fields(); it.hasNext(); ) {
            var e = it.next();
            if (!e.getKey().matches("^[0-9]{1,5}$")) {
                continue;
            }
            int id = Integer.parseInt(e.getKey());
            io.put(id, new IoElement(id, bytes(e.getValue())));
        }
        var record = new AvlRecord(Instant.ofEpochMilli(r.get("ts").asLong()), r.path("pr").asInt(0), lng, lat,
                r.path("alt").asInt(0), r.path("ang").asInt(0), r.path("sat").asInt(0), r.path("sp").asInt(0),
                r.path("evt").asInt(0), io);
        return new AvlPacket(CodecParser.CODEC_8_EXTENDED, List.of(record));
    }

    private static double[] pair(String s) {
        String[] parts = s.split(",");
        if (parts.length != 2) {
            throw new ProtocolException("Codec JSON position is not \"a,b\": " + s);
        }
        try {
            return new double[] {Double.parseDouble(parts[0].trim()), Double.parseDouble(parts[1].trim())};
        } catch (NumberFormatException e) {
            throw new ProtocolException("Codec JSON position is not numeric: " + s);
        }
    }

    /** Numbers as 8 bytes big-endian (two's complement); text as hex when it is hex, else its bytes. */
    private static byte[] bytes(JsonNode v) {
        if (v.isIntegralNumber()) {
            return ByteBuffer.allocate(8).putLong(v.longValue()).array();
        }
        if (v.isNumber()) {
            return ByteBuffer.allocate(8).putLong(Math.round(v.doubleValue())).array();
        }
        String s = v.asText().trim();
        if (!s.isEmpty() && s.length() % 2 == 0 && s.matches("^[0-9A-Fa-f]+$")) {
            return HexFormat.of().parseHex(s);
        }
        return s.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
}
