package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.*;

import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GeocodingQuotaStoreTest {
    private static final class Store extends GeocodingPlanRepository {
        String sql;
        Tuple params;
        boolean claimed = true;
        Store() { super(null); }

        @Override
        @SuppressWarnings("unchecked")
        protected RowSet<Row> execute(String query, Tuple values) {
            sql = query;
            params = values;
            io.vertx.sqlclient.Row row = (io.vertx.sqlclient.Row) Proxy.newProxyInstance(getClass().getClassLoader(),
                    new Class<?>[]{io.vertx.sqlclient.Row.class}, (proxy, method, args) -> null);
            var iterator = new io.vertx.sqlclient.RowIterator<io.vertx.sqlclient.Row>() {
                boolean available = claimed;
                public boolean hasNext() { return available; }
                public io.vertx.sqlclient.Row next() { available = false; return row; }
            };
            var rows = (io.vertx.sqlclient.RowSet<io.vertx.sqlclient.Row>) Proxy.newProxyInstance(getClass().getClassLoader(),
                    new Class<?>[]{io.vertx.sqlclient.RowSet.class}, (proxy, method, args) -> iterator);
            return RowSet.newInstance(rows, Row.__TYPE_ARG);
        }
    }

    @Test
    void claimAndJobAreOneStatementWithLevelMonthTenantAndPayloadBound() {
        var store = new Store();
        var month = LocalDate.of(2026, 10, 1);
        var payload = Map.<String, Object>of("month", "2026-10", "level", "exhausted");
        assertTrue(store.claimNotification("example-org", month, "exhausted", "tenant-1", "quota-key", payload));
        assertEquals("example-org", store.params.getString(0));
        assertEquals(month, store.params.getLocalDate(1));
        assertEquals("exhausted", store.params.getString(2));
        assertEquals("tenant-1", store.params.getString(3));
        assertEquals(payload, ((JsonObject) store.params.getValue(5)).getMap());
        assertTrue(store.sql.contains("WITH claimed AS"));
        assertTrue(store.sql.contains("ON CONFLICT DO NOTHING RETURNING organization"));
        assertTrue(store.sql.contains("INSERT INTO miot_integrations.async_jobs"));
        assertTrue(store.sql.contains("'geocoding_quota_notification'"));
        assertTrue(store.sql.contains("FROM claimed"));
        store.claimed = false;
        assertFalse(store.claimNotification("example-org", month, "exhausted", "tenant-1", "quota-key", payload));
    }

    @Test
    void migrationPreservesOldThresholdClaimsAndSeparatesTheLevels() throws Exception {
        try (var migration = getClass().getResourceAsStream("/db/migration/integrations/V0.6.37__geocoding_quota_notifications.sql")) {
            assertNotNull(migration);
            var sql = new String(migration.readAllBytes(), StandardCharsets.UTF_8);
            assertTrue(sql.contains("PRIMARY KEY (organization, month, level)"));
            assertTrue(sql.contains("level IN ('threshold', 'exhausted')"));
            assertTrue(sql.contains("SELECT organization, alerted_month, 'threshold'"));
            assertEquals(2, sql.split("ADD COLUMN whatsapp_recipients", -1).length - 1);
        }
    }
}
