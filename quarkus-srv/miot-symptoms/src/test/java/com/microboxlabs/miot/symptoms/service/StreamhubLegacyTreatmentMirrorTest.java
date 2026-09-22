package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.process.SymptomsGpsQuery;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import org.junit.jupiter.api.Test;

class StreamhubLegacyTreatmentMirrorTest {

    @Test
    void insertPayloadMatchesWhatTheSqlFunctionReads() {
        JsonObject json = StreamhubLegacyTreatmentMirror.payload(new LegacyTreatmentMirror.Write(
                null, "sym-client", 42L, "ABCD12", "trip-9", TreatmentType.CALL, "ops@example.com", null, null));

        assertEquals("sym-client", json.getString("client_id"));
        assertEquals("42", json.getString("symptom_id"));
        assertEquals("ABCD12", json.getString("asset_id"));
        assertEquals("trip-9", json.getString("trip_id"));
        assertEquals("llamar al conductor", json.getString("treatment_type"));
        assertEquals("pending", json.getString("status"));
        assertEquals("ops@example.com", json.getString("assigned_to"));
        assertFalse(json.containsKey("treatment_id"));
    }

    @Test
    void updatePayloadCarriesTheLegacyIdAndTheSummary() {
        JsonObject json = StreamhubLegacyTreatmentMirror.payload(new LegacyTreatmentMirror.Write(
                777L, "sym-client", 42L, "ABCD12", null, TreatmentType.IGNORE_CONDITION, "ops@example.com",
                "ignore: Zona de sombra", "nota"));

        assertEquals(777L, json.getLong("treatment_id"));
        assertEquals("N/A", json.getString("trip_id"));
        assertEquals("ignorar condicion", json.getString("treatment_type"));
        assertEquals("ignore: Zona de sombra", json.getString("message"));
        assertEquals("nota", json.getString("driver_response"));
    }

    @Test
    void unreachableGpsBecomesAMirrorException() {
        SymptomsGpsQuery down = (sql, params) -> Uni.createFrom().failure(new IllegalStateException("not configured"));
        var mirror = new StreamhubLegacyTreatmentMirror(down);

        var err = assertThrows(LegacyTreatmentMirror.MirrorException.class, () -> mirror.upsert(
                new LegacyTreatmentMirror.Write(null, "c", 1L, "A", null, TreatmentType.CALL, "u", null, null)));
        assertTrue(err.getMessage().contains("not configured"));
    }

    @Test
    void emptyResultBecomesAMirrorException() {
        SymptomsGpsQuery empty = (sql, params) -> Uni.createFrom().item(new EmptyRowSet());
        var mirror = new StreamhubLegacyTreatmentMirror(empty);

        assertThrows(LegacyTreatmentMirror.MirrorException.class, () -> mirror.upsert(
                new LegacyTreatmentMirror.Write(null, "c", 1L, "A", null, TreatmentType.CALL, "u", null, null)));
    }

    /** A RowSet with no rows, enough for the "no result" branch. */
    private static final class EmptyRowSet extends RowSet<Row> {
        EmptyRowSet() {
            super(new io.vertx.sqlclient.RowSet<io.vertx.sqlclient.Row>() {
                @Override public io.vertx.sqlclient.RowIterator<io.vertx.sqlclient.Row> iterator() {
                    return new io.vertx.sqlclient.RowIterator<>() {
                        @Override public boolean hasNext() { return false; }
                        @Override public io.vertx.sqlclient.Row next() { throw new java.util.NoSuchElementException(); }
                    };
                }
                @Override public io.vertx.sqlclient.RowSet<io.vertx.sqlclient.Row> value() { return this; }
                @Override public int rowCount() { return 0; }
                @Override public java.util.List<String> columnsNames() { return java.util.List.of(); }
                @Override public java.util.List<io.vertx.sqlclient.desc.ColumnDescriptor> columnDescriptors() { return java.util.List.of(); }
                @Override public int size() { return 0; }
                @Override public <V> V property(io.vertx.sqlclient.PropertyKind<V> propertyKind) { return null; }
                @Override public io.vertx.sqlclient.RowSet<io.vertx.sqlclient.Row> next() { return null; }
            });
        }
    }

    @SuppressWarnings("unused")
    private static Tuple unused() {
        return Tuple.tuple();
    }
}
