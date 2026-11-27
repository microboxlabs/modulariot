package com.microboxlabs.miot.teltonika.monitor;

import com.microboxlabs.miot.teltonika.mapping.TeltonikaIo;
import com.microboxlabs.miot.teltonika.protocol.AvlRecord;
import com.microboxlabs.miot.teltonika.protocol.IoElement;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * What changed in one device's status since the last flush: counters to add and the latest values
 * seen. Last values follow record time, so a buffered old record never overwrites a newer one.
 * Thread-safe: the session's event loop writes, the flusher drains.
 */
public final class StatusDelta {

    private final String imei;
    private OffsetDateTime seenAt;
    private String remoteAddress;
    private long connections;
    private long packets;
    private long recordsPublished;
    private long crcErrors;
    private long quarantinedPackets;
    private long recordsWithoutPosition;
    private long recordsOutOfTime;
    private Instant lastRecordAt;
    private Double latitude;
    private Double longitude;
    private Instant fixAt;
    private Integer gnssStatus;
    private Integer satellites;
    private Integer gsmSignal;
    private Integer externalVoltageMv;
    private Integer batteryVoltageMv;
    private Integer sleepMode;
    private Integer dataMode;
    private Boolean ignition;
    private Instant ignitionOnSeenAt;
    private Instant ignitionOffSeenAt;
    private String ibutton;
    private Instant ibuttonAt;
    private Integer recordIntervalS;

    public StatusDelta(String imei) {
        this.imei = imei;
    }

    public synchronized void connected(String address, Instant now) {
        connections++;
        remoteAddress = address;
        touch(now);
    }

    public synchronized void packet(Instant now) {
        packets++;
        touch(now);
    }

    public synchronized void crcError() {
        crcErrors++;
    }

    public synchronized void quarantined() {
        quarantinedPackets++;
    }

    public synchronized void outcome(int published, int withoutPosition, int outOfTime) {
        recordsPublished += published;
        recordsWithoutPosition += withoutPosition;
        recordsOutOfTime += outOfTime;
    }

    /**
     * What one record says about the device, whatever the source; null fields were not reported.
     *
     * @param currentFix the device has a current fix (not the last known position repeated)
     */
    public record Observation(Instant time, Double latitude, Double longitude, boolean currentFix,
            Integer satellites, Integer gnssStatus, Integer gsmSignal, Integer externalVoltageMv,
            Integer batteryVoltageMv, Integer sleepMode, Integer dataMode, Boolean ignition, String ibutton) {

        static Observation of(AvlRecord r) {
            boolean position = r.latitude() != 0 || r.longitude() != 0;
            Integer gnss = io(r, TeltonikaIo.GNSS_STATUS);
            IoElement ign = r.ioElement(TeltonikaIo.IGNITION);
            IoElement key = r.ioElement(TeltonikaIo.IBUTTON);
            return new Observation(r.timestamp(), position ? r.latitude() : null, position ? r.longitude() : null,
                    Integer.valueOf(1).equals(gnss) || (gnss == null && r.satellites() > 0), r.satellites(), gnss,
                    io(r, TeltonikaIo.GSM_SIGNAL), io(r, TeltonikaIo.EXTERNAL_VOLTAGE),
                    io(r, TeltonikaIo.BATTERY_VOLTAGE), io(r, TeltonikaIo.SLEEP_MODE), io(r, TeltonikaIo.DATA_MODE),
                    ign == null ? null : ign.unsigned() == 1, key == null || key.isZero() ? null : key.hex());
        }

        private static Integer io(AvlRecord r, int id) {
            IoElement e = r.ioElement(id);
            return e == null ? null : Integer.valueOf((int) e.unsigned());
        }
    }

    /** Takes the record's values when it is the newest seen. */
    public synchronized void record(AvlRecord r) {
        observe(Observation.of(r));
    }

    /** Takes the values when they are the newest seen; sightings count from older records too. */
    public synchronized void observe(Observation o) {
        Instant t = o.time();
        if (lastRecordAt != null && !t.isAfter(lastRecordAt)) {
            sightings(o, t);
            return;
        }
        if (lastRecordAt != null) {
            recordIntervalS = (int) Math.min(Integer.MAX_VALUE, (t.toEpochMilli() - lastRecordAt.toEpochMilli()) / 1000);
        }
        lastRecordAt = t;
        if (o.latitude() != null && o.longitude() != null) {
            latitude = o.latitude();
            longitude = o.longitude();
        }
        if (o.satellites() != null) {
            satellites = o.satellites();
        }
        gnssStatus = or(o.gnssStatus(), gnssStatus);
        if (o.currentFix()) {
            fixAt = t;
        }
        gsmSignal = or(o.gsmSignal(), gsmSignal);
        externalVoltageMv = or(o.externalVoltageMv(), externalVoltageMv);
        batteryVoltageMv = or(o.batteryVoltageMv(), batteryVoltageMv);
        sleepMode = or(o.sleepMode(), sleepMode);
        dataMode = or(o.dataMode(), dataMode);
        if (o.ignition() != null) {
            ignition = o.ignition();
        }
        sightings(o, t);
    }

    /** Ignition changes and iButton reads count even from older buffered records. */
    private void sightings(Observation o, Instant t) {
        if (o.ignition() != null) {
            if (o.ignition()) {
                ignitionOnSeenAt = later(ignitionOnSeenAt, t);
            } else {
                ignitionOffSeenAt = later(ignitionOffSeenAt, t);
            }
        }
        if (o.ibutton() != null && (ibuttonAt == null || t.isAfter(ibuttonAt))) {
            ibutton = o.ibutton();
            ibuttonAt = t;
        }
    }

    private void touch(Instant now) {
        seenAt = OffsetDateTime.ofInstant(now, ZoneOffset.UTC);
    }

    private static Instant later(Instant a, Instant b) {
        return a == null || b.isAfter(a) ? b : a;
    }

    private static Integer or(Integer value, Integer previous) {
        return value == null ? previous : value;
    }

    /** A consistent copy, then the counters restart; the last values stay for the next flush. */
    public synchronized StatusDelta drain() {
        StatusDelta copy = new StatusDelta(imei);
        copy.seenAt = seenAt;
        copy.remoteAddress = remoteAddress;
        copy.connections = connections;
        copy.packets = packets;
        copy.recordsPublished = recordsPublished;
        copy.crcErrors = crcErrors;
        copy.quarantinedPackets = quarantinedPackets;
        copy.recordsWithoutPosition = recordsWithoutPosition;
        copy.recordsOutOfTime = recordsOutOfTime;
        copy.lastRecordAt = lastRecordAt;
        copy.latitude = latitude;
        copy.longitude = longitude;
        copy.fixAt = fixAt;
        copy.gnssStatus = gnssStatus;
        copy.satellites = satellites;
        copy.gsmSignal = gsmSignal;
        copy.externalVoltageMv = externalVoltageMv;
        copy.batteryVoltageMv = batteryVoltageMv;
        copy.sleepMode = sleepMode;
        copy.dataMode = dataMode;
        copy.ignition = ignition;
        copy.ignitionOnSeenAt = ignitionOnSeenAt;
        copy.ignitionOffSeenAt = ignitionOffSeenAt;
        copy.ibutton = ibutton;
        copy.ibuttonAt = ibuttonAt;
        copy.recordIntervalS = recordIntervalS;
        connections = 0;
        packets = 0;
        recordsPublished = 0;
        crcErrors = 0;
        quarantinedPackets = 0;
        recordsWithoutPosition = 0;
        recordsOutOfTime = 0;
        return copy;
    }

    /** Puts back the counters of a delta that could not be written, so they are not lost. */
    public synchronized void restore(StatusDelta failed) {
        connections += failed.connections;
        packets += failed.packets;
        recordsPublished += failed.recordsPublished;
        crcErrors += failed.crcErrors;
        quarantinedPackets += failed.quarantinedPackets;
        recordsWithoutPosition += failed.recordsWithoutPosition;
        recordsOutOfTime += failed.recordsOutOfTime;
    }

    public synchronized boolean isEmpty() {
        return seenAt == null && lastRecordAt == null && connections == 0 && packets == 0 && crcErrors == 0;
    }

    public String imei() {
        return imei;
    }

    public OffsetDateTime seenAt() {
        return seenAt;
    }

    public String remoteAddress() {
        return remoteAddress;
    }

    public long connections() {
        return connections;
    }

    public long packets() {
        return packets;
    }

    public long recordsPublished() {
        return recordsPublished;
    }

    public long crcErrors() {
        return crcErrors;
    }

    public long quarantinedPackets() {
        return quarantinedPackets;
    }

    public long recordsWithoutPosition() {
        return recordsWithoutPosition;
    }

    public long recordsOutOfTime() {
        return recordsOutOfTime;
    }

    public OffsetDateTime lastRecordAt() {
        return utc(lastRecordAt);
    }

    public Double latitude() {
        return latitude;
    }

    public Double longitude() {
        return longitude;
    }

    public OffsetDateTime fixAt() {
        return utc(fixAt);
    }

    public Integer gnssStatus() {
        return gnssStatus;
    }

    public Integer satellites() {
        return satellites;
    }

    public Integer gsmSignal() {
        return gsmSignal;
    }

    public Integer externalVoltageMv() {
        return externalVoltageMv;
    }

    public Integer batteryVoltageMv() {
        return batteryVoltageMv;
    }

    public Integer sleepMode() {
        return sleepMode;
    }

    public Integer dataMode() {
        return dataMode;
    }

    public Boolean ignition() {
        return ignition;
    }

    public OffsetDateTime ignitionOnSeenAt() {
        return utc(ignitionOnSeenAt);
    }

    public OffsetDateTime ignitionOffSeenAt() {
        return utc(ignitionOffSeenAt);
    }

    public String ibutton() {
        return ibutton;
    }

    public OffsetDateTime ibuttonAt() {
        return utc(ibuttonAt);
    }

    public Integer recordIntervalS() {
        return recordIntervalS;
    }

    private static OffsetDateTime utc(Instant t) {
        return t == null ? null : OffsetDateTime.ofInstant(t, ZoneOffset.UTC);
    }
}
