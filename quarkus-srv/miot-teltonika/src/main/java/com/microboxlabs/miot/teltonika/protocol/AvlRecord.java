package com.microboxlabs.miot.teltonika.protocol;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One AVL record: device time, priority, GPS element and I/O properties.
 *
 * @param timestamp   device time (UTC)
 * @param priority    0 low, 1 high, 2 panic
 * @param longitude   degrees, WGS84
 * @param latitude    degrees, WGS84
 * @param altitude    meters above sea level
 * @param angle       degrees from north
 * @param satellites  satellites in use
 * @param speed       km/h; 0 when the GPS data is invalid
 * @param eventIoId   AVL ID that generated the record; 0 for periodic records
 * @param io          I/O properties by AVL ID, in arrival order
 */
public record AvlRecord(
        Instant timestamp,
        int priority,
        double longitude,
        double latitude,
        int altitude,
        int angle,
        int satellites,
        int speed,
        int eventIoId,
        Map<Integer, IoElement> io) {

    public AvlRecord {
        io = Collections.unmodifiableMap(new LinkedHashMap<>(io));
    }

    public IoElement ioElement(int id) {
        return io.get(id);
    }

    public boolean hasIo(int id) {
        return io.containsKey(id);
    }
}
