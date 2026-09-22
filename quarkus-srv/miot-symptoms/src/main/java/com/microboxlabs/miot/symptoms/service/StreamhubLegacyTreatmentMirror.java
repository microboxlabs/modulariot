package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.process.SymptomsGpsQuery;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * Calls {@code public.process_treatment_manual_notifi_audit(jsonb)} on the GPS
 * database, the same function the previous tower UI reached through pgREST.
 * The function upserts {@code treatments} and links {@code symptom_treatments};
 * it answers a JSON envelope whose {@code status} is 200 on success.
 */
@ApplicationScoped
public class StreamhubLegacyTreatmentMirror implements LegacyTreatmentMirror {

    private static final Logger LOG = Logger.getLogger(StreamhubLegacyTreatmentMirror.class);

    static final String LEGACY_STATUS = "pending";
    private static final String SQL = "SELECT process_treatment_manual_notifi_audit($1::jsonb) AS result";

    private final SymptomsGpsQuery gps;

    @Inject
    public StreamhubLegacyTreatmentMirror(SymptomsGpsQuery gps) {
        this.gps = gps;
    }

    @Override
    public long upsert(Write w) {
        JsonObject payload = payload(w);
        RowSet<Row> rows;
        try {
            rows = gps.query(SQL, Tuple.of(payload)).await().indefinitely();
        } catch (RuntimeException e) {
            throw new MirrorException("StreamHub treatment mirror unavailable: " + e.getMessage(), e);
        }
        if (!rows.iterator().hasNext()) {
            throw new MirrorException("StreamHub treatment mirror returned no result");
        }
        Object value = rows.iterator().next().getValue("result");
        JsonObject result = value instanceof JsonObject json ? json : new JsonObject(String.valueOf(value));
        Integer status = result.getInteger("status");
        JsonObject data = result.getJsonObject("data");
        Long id = data == null ? null : data.getLong("treatment_id");
        if (status == null || status != 200 || id == null) {
            LOG.warnf("Legacy treatment mirror refused symptom=%d: %s", w.symptomId(), result.encode());
            throw new MirrorException("StreamHub treatment mirror refused: " + result.getString("message"));
        }
        return id;
    }

    /** The exact shape the SQL function reads; kept static so tests can check it without a database. */
    static JsonObject payload(Write w) {
        JsonObject json = new JsonObject()
                .put("client_id", w.symptomsClientId())
                .put("symptom_id", String.valueOf(w.symptomId()))
                .put("asset_id", w.assetId())
                .put("trip_id", w.tripId() == null ? "N/A" : w.tripId())
                .put("treatment_type", w.type().legacyType())
                .put("status", LEGACY_STATUS)
                .put("assigned_to", w.assignedTo())
                .put("message", w.message())
                .put("driver_response", w.driverResponse());
        if (w.legacyTreatmentId() != null) {
            json.put("treatment_id", w.legacyTreatmentId());
        }
        return json;
    }
}
