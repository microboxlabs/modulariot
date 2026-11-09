package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.*;

import com.microboxlabs.miot.core.telephony.InboundCallers.Caller;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Real routing SQL against an explicitly supplied scratch database, without containers. */
@EnabledIfSystemProperty(named = "miot.symptoms.test.pg-url", matches = ".+")
class PgInboundCallersQueriesTest {

    private static final Duration WAIT = Duration.ofSeconds(10);

    @Test
    void duplicateContactsCannotHideAnotherOrganizationAndCasesStayInTheMatchedOrganization() {
        Vertx vertx = Vertx.vertx();
        Pool pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url")))
                .using(vertx).build();
        String schema = "cert_inbound_" + UUID.randomUUID().toString().replace("-", "");
        try {
            pool.query("CREATE SCHEMA " + schema).execute().await().atMost(WAIT);
            pool.query("""
                    CREATE TABLE %1$s.contact (id uuid, tenant_code text, name text, phone text,
                        channels jsonb, active boolean, created_at timestamptz);
                    CREATE TABLE %1$s.treatment (id uuid, tenant_code text, symptom_id bigint, status text);
                    CREATE TABLE %1$s.treatment_action (treatment_id uuid, tenant_code text, kind text,
                        contact_id uuid, contact_phone text, performed_at timestamptz);
                    INSERT INTO %1$s.contact
                        SELECT gen_random_uuid(), 'tenant-a', 'Test contact', '+1 202 555 0101', '{}', true, now()
                        FROM generate_series(1, 25);
                    INSERT INTO %1$s.contact VALUES
                        (gen_random_uuid(), 'tenant-b', 'Other contact', NULL,
                        '{"whatsapp":"12025550101"}', true, now());
                    """.formatted(schema)).execute().await().atMost(WAIT);
            PgInboundCallers callers = new PgInboundCallers(() -> pool) {
                @Override
                protected RowSet<Row> run(String sql, Tuple params) {
                    return super.run(sql.replace("miot_symptoms", schema), params);
                }
            };
            var ambiguous = callers.lookup("+12025550101");
            assertTrue(ambiguous.ambiguous(), "25 contacts in one organization cannot hide a second organization");
            assertTrue(ambiguous.caller().isEmpty());
            assertTrue(callers.find("+12025550101").isEmpty());

            pool.query("""
                    UPDATE %1$s.contact SET active = false WHERE tenant_code = 'tenant-b';
                    INSERT INTO %1$s.treatment VALUES
                        ('00000000-0000-0000-0000-000000000001', 'tenant-a', 11, 'OPEN'),
                        ('00000000-0000-0000-0000-000000000002', 'tenant-b', 22, 'OPEN');
                    INSERT INTO %1$s.treatment_action VALUES
                        ('00000000-0000-0000-0000-000000000001', 'tenant-a', 'CALL', NULL,
                        '+12025550101', now() - interval '1 minute'),
                        ('00000000-0000-0000-0000-000000000002', 'tenant-b', 'CALL', NULL,
                        '+12025550101', now());
                    """.formatted(schema)).execute().await().atMost(WAIT);
            var matched = callers.lookup("+12025550101");
            assertFalse(matched.ambiguous());
            assertEquals(new Caller("tenant-a", "Test contact", "11"), matched.caller().orElseThrow());
            var unknown = callers.lookup("+12025550199");
            assertFalse(unknown.ambiguous());
            assertTrue(unknown.caller().isEmpty());
        } finally {
            try {
                pool.query("DROP SCHEMA IF EXISTS " + schema + " CASCADE").execute().await().atMost(WAIT);
            } finally {
                pool.closeAndAwait();
                vertx.closeAndAwait();
            }
        }
    }
}
