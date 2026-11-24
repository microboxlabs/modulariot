package com.microboxlabs.miot.teltonika.store;

import com.microboxlabs.miot.teltonika.monitor.DeviceStatus;
import com.microboxlabs.miot.teltonika.monitor.MonitorStore;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.monitor.PendingPacket;
import com.microboxlabs.miot.teltonika.monitor.StatusDelta;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.core.buffer.Buffer;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/** {@link MonitorStore} on the modulith database, schema {@code miot_teltonika}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class PgMonitorStore implements MonitorStore {

    private static final String PACKET_COLUMNS =
            "imei, tenant_code, received_at, remote_address, outcome, reason, codec_id, record_count, packet, format";

    private final PgSupport pg;
    private final String status;
    private final String packetLog;
    private final String device;

    @Inject
    PgMonitorStore(Instance<Pool> pool) {
        this(pool::get, PgSupport.DEFAULT_SCHEMA);
    }

    public PgMonitorStore(Supplier<Pool> pool, String schema) {
        this.pg = new PgSupport(pool, schema);
        this.status = pg.table("device_status");
        this.packetLog = pg.table("packet_log");
        this.device = pg.table("device");
    }

    @Override
    public void applyStatus(Collection<StatusDelta> deltas) {
        // Counters add up; last values move only forward in record time; sightings older than the
        // last reset do not count. Unknown IMEIs (device deleted meanwhile) are skipped.
        String newer = "EXCLUDED.last_record_at IS NOT NULL AND (s.last_record_at IS NULL"
                + " OR EXCLUDED.last_record_at >= s.last_record_at)";
        String reset = "COALESCE(s.sightings_reset_at, '-infinity'::timestamptz)";
        String sql = "INSERT INTO " + status + " AS s (imei, first_seen_at, last_seen_at, last_record_at,"
                + " last_remote_address, connections, packets, records_published, crc_errors, quarantined_packets,"
                + " records_without_position, records_out_of_time, last_latitude, last_longitude, last_fix_at,"
                + " last_gnss_status, last_satellites, last_gsm_signal, last_external_voltage_mv,"
                + " last_battery_voltage_mv, last_sleep_mode, last_data_mode, last_ignition, ignition_on_seen_at,"
                + " ignition_off_seen_at, last_ibutton, last_ibutton_at, last_record_interval_s, updated_at)"
                + " SELECT $1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,"
                + " $20, $21, $22, $23, $24, $25, $26, $27, now()"
                + " WHERE EXISTS (SELECT 1 FROM " + device + " WHERE imei = $1)"
                + " ON CONFLICT (imei) DO UPDATE SET"
                + " first_seen_at = COALESCE(s.first_seen_at, EXCLUDED.first_seen_at),"
                + " last_seen_at = GREATEST(s.last_seen_at, EXCLUDED.last_seen_at),"
                + " last_remote_address = COALESCE(EXCLUDED.last_remote_address, s.last_remote_address),"
                + " connections = s.connections + EXCLUDED.connections,"
                + " packets = s.packets + EXCLUDED.packets,"
                + " records_published = s.records_published + EXCLUDED.records_published,"
                + " crc_errors = s.crc_errors + EXCLUDED.crc_errors,"
                + " quarantined_packets = s.quarantined_packets + EXCLUDED.quarantined_packets,"
                + " records_without_position = s.records_without_position + EXCLUDED.records_without_position,"
                + " records_out_of_time = s.records_out_of_time + EXCLUDED.records_out_of_time,"
                + " last_record_at = GREATEST(s.last_record_at, EXCLUDED.last_record_at),"
                + " last_latitude = CASE WHEN " + newer + " THEN COALESCE(EXCLUDED.last_latitude, s.last_latitude)"
                + "   ELSE s.last_latitude END,"
                + " last_longitude = CASE WHEN " + newer + " THEN COALESCE(EXCLUDED.last_longitude, s.last_longitude)"
                + "   ELSE s.last_longitude END,"
                + " last_fix_at = GREATEST(s.last_fix_at, EXCLUDED.last_fix_at),"
                + " last_gnss_status = CASE WHEN " + newer + " THEN EXCLUDED.last_gnss_status ELSE s.last_gnss_status END,"
                + " last_satellites = CASE WHEN " + newer + " THEN EXCLUDED.last_satellites ELSE s.last_satellites END,"
                + " last_gsm_signal = CASE WHEN " + newer + " THEN EXCLUDED.last_gsm_signal ELSE s.last_gsm_signal END,"
                + " last_external_voltage_mv = CASE WHEN " + newer
                + "   THEN EXCLUDED.last_external_voltage_mv ELSE s.last_external_voltage_mv END,"
                + " last_battery_voltage_mv = CASE WHEN " + newer
                + "   THEN EXCLUDED.last_battery_voltage_mv ELSE s.last_battery_voltage_mv END,"
                + " last_sleep_mode = CASE WHEN " + newer + " THEN EXCLUDED.last_sleep_mode ELSE s.last_sleep_mode END,"
                + " last_data_mode = CASE WHEN " + newer + " THEN EXCLUDED.last_data_mode ELSE s.last_data_mode END,"
                + " last_ignition = CASE WHEN " + newer + " THEN EXCLUDED.last_ignition ELSE s.last_ignition END,"
                + " ignition_on_seen_at = CASE WHEN EXCLUDED.ignition_on_seen_at > " + reset
                + "   THEN GREATEST(s.ignition_on_seen_at, EXCLUDED.ignition_on_seen_at) ELSE s.ignition_on_seen_at END,"
                + " ignition_off_seen_at = CASE WHEN EXCLUDED.ignition_off_seen_at > " + reset
                + "   THEN GREATEST(s.ignition_off_seen_at, EXCLUDED.ignition_off_seen_at) ELSE s.ignition_off_seen_at END,"
                + " last_ibutton = CASE WHEN EXCLUDED.last_ibutton_at > " + reset + " AND (s.last_ibutton_at IS NULL"
                + "   OR EXCLUDED.last_ibutton_at >= s.last_ibutton_at) THEN EXCLUDED.last_ibutton ELSE s.last_ibutton END,"
                + " last_ibutton_at = CASE WHEN EXCLUDED.last_ibutton_at > " + reset
                + "   THEN GREATEST(s.last_ibutton_at, EXCLUDED.last_ibutton_at) ELSE s.last_ibutton_at END,"
                + " last_record_interval_s = CASE WHEN " + newer
                + "   THEN COALESCE(EXCLUDED.last_record_interval_s, s.last_record_interval_s)"
                + "   ELSE s.last_record_interval_s END,"
                + " updated_at = now()";
        List<Tuple> rows = new ArrayList<>(deltas.size());
        for (StatusDelta d : deltas) {
            rows.add(Tuple.tuple()
                    .addString(d.imei()).addOffsetDateTime(d.seenAt()).addOffsetDateTime(d.lastRecordAt())
                    .addString(d.remoteAddress()).addLong(d.connections()).addLong(d.packets())
                    .addLong(d.recordsPublished()).addLong(d.crcErrors()).addLong(d.quarantinedPackets())
                    .addLong(d.recordsWithoutPosition()).addLong(d.recordsOutOfTime())
                    .addDouble(d.latitude()).addDouble(d.longitude()).addOffsetDateTime(d.fixAt())
                    .addInteger(d.gnssStatus()).addInteger(d.satellites()).addInteger(d.gsmSignal())
                    .addInteger(d.externalVoltageMv()).addInteger(d.batteryVoltageMv()).addInteger(d.sleepMode())
                    .addInteger(d.dataMode()).addBoolean(d.ignition()).addOffsetDateTime(d.ignitionOnSeenAt())
                    .addOffsetDateTime(d.ignitionOffSeenAt()).addString(d.ibutton())
                    .addOffsetDateTime(d.ibuttonAt()).addInteger(d.recordIntervalS()));
        }
        pg.batch(sql, rows);
    }

    @Override
    public Optional<DeviceStatus> status(String imei) {
        var it = pg.query("SELECT * FROM " + status + " WHERE imei = $1", Tuple.of(imei)).iterator();
        if (!it.hasNext()) {
            return Optional.empty();
        }
        Row r = it.next();
        return Optional.of(new DeviceStatus(r.getString("imei"), r.getOffsetDateTime("first_seen_at"),
                r.getOffsetDateTime("last_seen_at"), r.getOffsetDateTime("last_record_at"),
                r.getString("last_remote_address"), r.getLong("connections"), r.getLong("packets"),
                r.getLong("records_published"), r.getLong("crc_errors"), r.getLong("quarantined_packets"),
                r.getLong("records_without_position"), r.getLong("records_out_of_time"),
                r.getDouble("last_latitude"), r.getDouble("last_longitude"), r.getOffsetDateTime("last_fix_at"),
                r.getInteger("last_gnss_status"), r.getInteger("last_satellites"), r.getInteger("last_gsm_signal"),
                r.getInteger("last_external_voltage_mv"), r.getInteger("last_battery_voltage_mv"),
                r.getInteger("last_sleep_mode"), r.getInteger("last_data_mode"), r.getBoolean("last_ignition"),
                r.getOffsetDateTime("ignition_on_seen_at"), r.getOffsetDateTime("ignition_off_seen_at"),
                r.getString("last_ibutton"), r.getOffsetDateTime("last_ibutton_at"),
                r.getInteger("last_record_interval_s")));
    }

    @Override
    public void resetSightings(String imei) {
        pg.query("UPDATE " + status + " SET ignition_on_seen_at = NULL, ignition_off_seen_at = NULL,"
                + " last_ibutton = NULL, last_ibutton_at = NULL, sightings_reset_at = now(), updated_at = now()"
                + " WHERE imei = $1", Tuple.of(imei));
    }

    @Override
    public void appendPackets(Collection<PacketLogEntry> entries) {
        List<Tuple> rows = new ArrayList<>(entries.size());
        for (PacketLogEntry e : entries) {
            rows.add(Tuple.tuple().addString(e.imei()).addString(e.tenantCode()).addOffsetDateTime(e.receivedAt())
                    .addString(e.remoteAddress()).addString(e.outcome()).addString(e.reason())
                    .addInteger(e.codecId()).addInteger(e.recordCount()).addBuffer(Buffer.buffer(e.packet()))
                    .addString(e.format()));
        }
        pg.batch("INSERT INTO " + packetLog + " (" + PACKET_COLUMNS + ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,"
                + " $10)",
                rows);
    }

    @Override
    public List<PacketLogEntry> packets(String imei, int limit) {
        return read("SELECT " + PACKET_COLUMNS + " FROM " + packetLog
                + " WHERE imei = $1 ORDER BY received_at DESC, id DESC LIMIT $2", Tuple.of(imei, limit));
    }

    @Override
    public List<PendingPacket> pendingActivation(String imei) {
        List<PendingPacket> out = new ArrayList<>();
        pg.query("SELECT id, " + PACKET_COLUMNS + " FROM " + packetLog + " WHERE imei = $1 AND outcome = $2"
                + " ORDER BY received_at, id", Tuple.of(imei, PacketLogEntry.PENDING_ACTIVATION))
                .forEach(r -> out.add(new PendingPacket(r.getLong("id"), entry(r))));
        return out;
    }

    @Override
    public void markReplayed(String imei, Collection<Long> ids) {
        if (ids.isEmpty()) {
            return;
        }
        pg.query("UPDATE " + packetLog + " SET outcome = $2 WHERE imei = $1 AND outcome = $3 AND id = ANY($4)",
                Tuple.of(imei, PacketLogEntry.REPLAYED, PacketLogEntry.PENDING_ACTIVATION,
                        ids.toArray(new Long[0])));
    }

    @Override
    public List<String> devicesWithPendingPackets() {
        List<String> out = new ArrayList<>();
        pg.query("SELECT DISTINCT imei FROM " + packetLog + " WHERE outcome = $1",
                Tuple.of(PacketLogEntry.PENDING_ACTIVATION)).forEach(r -> out.add(r.getString("imei")));
        return out;
    }

    /** pg_partman drops the partitions older than the retention configured by the migration. */
    @Override
    public void applyRetention(OffsetDateTime before) {
        pg.query("SELECT partman.run_maintenance($1)", Tuple.of(packetLog));
    }

    private List<PacketLogEntry> read(String sql, Tuple params) {
        List<PacketLogEntry> out = new ArrayList<>();
        pg.query(sql, params).forEach(r -> out.add(entry(r)));
        return out;
    }

    private static PacketLogEntry entry(Row r) {
        return new PacketLogEntry(r.getString("imei"), r.getString("tenant_code"), r.getOffsetDateTime("received_at"),
                r.getString("remote_address"), r.getString("outcome"), r.getString("reason"), r.getInteger("codec_id"),
                r.getInteger("record_count"), r.getBuffer("packet").getBytes(), r.getString("format"));
    }
}
