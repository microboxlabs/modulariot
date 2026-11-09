package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.*;

import com.microboxlabs.miot.integrations.service.TestManagedConnectionLock;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "miot.integrations.test.pg-url", matches = ".+")
class PgTelephonyUsageStoreTest {
    @Test
    void templateWidthAndConcurrentProviderBrowserTransitions() throws Exception {
        Vertx vertx = Vertx.vertx();
        Pool pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.pg-url")))
                .with(new PoolOptions().setMaxSize(4)).using(vertx).build();
        String schema = "cert_voice_" + UUID.randomUUID().toString().replace("-", "");
        try {
            pool.query("CREATE SCHEMA " + schema).execute().await().indefinitely();
            for (String migration : new String[]{"V0.6.39__telephony_usage.sql", "V0.6.40__telephony_destination_width.sql",
                    "V0.6.41__telephony_admissions_and_reconcile_progress.sql", "V0.6.42__whatsapp_calls.sql"}) {
                try (var resource = getClass().getResourceAsStream("/db/migration/integrations/" + migration)) {
                    assertNotNull(resource);
                    pool.query(new String(resource.readAllBytes(), StandardCharsets.UTF_8).replace("miot_integrations", schema))
                            .execute().await().indefinitely();
                }
            }
            PgTelephonyUsageStore store = new PgTelephonyUsageStore(() -> pool, TestManagedConnectionLock.forPool(pool)) {
                @Override protected RowSet<Row> run(String sql, Tuple params) {
                    return super.run(sql.replace("miot_integrations", schema), params);
                }
            };
            Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
            new ManagedUsageRecorder(store).whatsAppTemplate("acme", com.microboxlabs.miot.core.auth.PlatformScope.TENANT,
                    "wamid.cert", now);
            assertEquals(1, store.rows("acme", now.minusSeconds(1), now.plusSeconds(1)).size());
            String ref = UUID.randomUUID().toString();
            store.insert(new UsageRow(ref, "acme", UsageRow.VOICE, true, "p1", null, "case-a", "+56221111111",
                    TelephonyPlanDtos.CL_LANDLINE, UsageRow.STARTED, null, null, null, null, null, null,
                    now.minusSeconds(120), null, null));
            var events = new TelnyxCallEvents(store, new InboundRouter(store), new ObjectMapper());
            String state = Base64.getEncoder().encodeToString(ref.getBytes(StandardCharsets.UTF_8));
            String payload = "\"client_state\":\"" + state + "\",\"call_control_id\":\"v3:race\",\"to\":\"+51911111111\"";
            var telephony = new IntegrationsTelephony((t, p) -> null, null, null, store, null, java.time.Clock.systemUTC());
            CyclicBarrier barrier = new CyclicBarrier(3);
            try (var workers = Executors.newFixedThreadPool(3)) {
                var answer = workers.submit(() -> { barrier.await(); return events.apply("p1", event("call.answered", now.minusSeconds(65), payload)); });
                var hangup = workers.submit(() -> { barrier.await(); return events.apply("p1", event("call.hangup", now, payload)); });
                var browser = workers.submit(() -> { barrier.await(); telephony.callEnded("acme", ref, "spoofed"); return true; });
                answer.get(10, TimeUnit.SECONDS); hangup.get(10, TimeUnit.SECONDS); browser.get(10, TimeUnit.SECONDS);
            }
            UsageRow row = store.find(ref).orElseThrow();
            assertEquals(UsageRow.CONFIRMED, row.status());
            assertEquals(65, row.seconds());
            assertEquals("v3:race", row.externalId());
            assertEquals("+51911111111", row.calleeNumber());
            assertEquals(TelephonyPlanDtos.OTHER, row.destinationType());
            assertEquals(2, store.billedMinutes("acme", now.minusSeconds(3600), now.plusSeconds(1)));
            assertEquals(0, store.busyChannels("p1", now.minusSeconds(3600)));
            assertEquals("acme", store.latestCallerTenant("51911111111", now.minusSeconds(3600)).orElseThrow());
            assertEquals(java.util.List.of("acme"), store.tenants(now.minusSeconds(3600), now.plusSeconds(1)));
            store.saveSubscription("beta", 120, "owner");
            assertEquals(120, store.subscription("beta").orElseThrow().monthlyMinutes());
            assertNotNull(store.plan());
            store.saveCredential("login", "acme", "cred", "sip-1");
            assertTrue(store.tenantOfSip("login", "sip-other").isEmpty());
            assertEquals("acme", store.tenantOfSip("login", "sip-1").orElseThrow());
            CallAdmission admission = new CallAdmission(ref, "sdk-1", UUID.randomUUID().toString());
            store.saveAdmission(admission);
            assertEquals(admission, store.admission(ref).orElseThrow());
            assertEquals(admission, store.admissionByParkedCall("sdk-1").orElseThrow());
            assertEquals(admission, store.admissionByTargetState(admission.targetState()).orElseThrow());
            assertThrows(RuntimeException.class, () -> store.saveAdmission(new CallAdmission(ref, "sdk-2", UUID.randomUUID().toString())));
            var cursor = new TelephonyUsageStore.ReconcileCursor(21, now);
            store.saveReconcileCursor("p1", cursor);
            assertEquals(cursor, store.reconcileCursor("p1").orElseThrow());
            store.saveReconcileCursor("p1", new TelephonyUsageStore.ReconcileCursor(41, now));
            assertEquals(41, store.reconcileCursor("p1").orElseThrow().nextPage());
            store.clearReconcileCursor("p1");
            assertTrue(store.reconcileCursor("p1").isEmpty());
        } finally {
            pool.query("DROP SCHEMA " + schema + " CASCADE").execute().await().indefinitely();
            pool.closeAndAwait(); vertx.closeAndAwait();
        }
    }

    private static String event(String type, Instant at, String payload) {
        return "{\"data\":{\"event_type\":\"" + type + "\",\"occurred_at\":\"" + at + "\",\"payload\":{" + payload + "}}}";
    }
}
