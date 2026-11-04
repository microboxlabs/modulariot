package com.microboxlabs.miot.conversational.calling;

import static org.junit.jupiter.api.Assertions.*;

import com.microboxlabs.miot.conversational.service.CallEvent;
import com.microboxlabs.miot.conversational.service.CallPermissionReply;
import com.microboxlabs.miot.integrations.service.ManagedConnectionLock;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import jakarta.enterprise.inject.Instance;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "miot.conversational.test.pg-url", matches = ".+")
class PgCallPermissionStoreTest {
    private static final Instant NOW = Instant.parse("2026-11-04T12:00:00Z");
    private static final String NUMBER = "PNID", CONTACT = "+56900000001";

    @Test @SuppressWarnings("unchecked")
    void replaysDistinctCallsAndRepliesAtomicallyAcrossRetriesAndInstances() throws Exception {
        Vertx vertx = Vertx.vertx();
        Pool pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.conversational.test.pg-url")))
                .with(new PoolOptions().setMaxSize(5)).using(vertx).build();
        String schema = "cert_call_" + UUID.randomUUID().toString().replace("-", "");
        try {
            pool.query("CREATE SCHEMA " + schema).execute().await().indefinitely();
            // Earlier migrations supply the template table. Exercise the real permission migrations unchanged.
            String rules = resource("V0.9.8__conversation_rules.sql");
            int start = rules.indexOf("CREATE TABLE miot_conversational.conv_template");
            pool.query(rules.substring(start, rules.indexOf(";", start)).replace("miot_conversational", schema))
                    .execute().await().indefinitely();
            pool.query("ALTER TABLE " + schema + ".conv_template ADD COLUMN version VARCHAR(32)").execute().await().indefinitely();
            for (String migration : List.of("V0.11.8__whatsapp_call_permissions.sql", "V0.11.9__call_permission_journal.sql")) {
                pool.query(resource(migration).replace("miot_conversational", schema)).execute().await().indefinitely();
            }
            Instance<Pool> pools = (Instance<Pool>) java.lang.reflect.Proxy.newProxyInstance(
                    Instance.class.getClassLoader(), new Class<?>[]{Instance.class}, (proxy, method, args) -> {
                        if ("get".equals(method.getName())) return pool;
                        throw new UnsupportedOperationException(method.getName());
                    });
            PgCallPermissionStore store = new PgCallPermissionStore(() -> pool, new ManagedConnectionLock(pools)) {
                @Override protected RowSet<Row> query(String sql, Tuple params) {
                    return super.query(sql.replace("miot_conversational", schema), params);
                }
            };
            CallPermissionService first = service(store), second = service(store);
            first.applyReply(grant("grant-1", NOW.minusSeconds(120)));
            CyclicBarrier barrier = new CyclicBarrier(4);
            try (var workers = Executors.newFixedThreadPool(4)) {
                var futures = new ArrayList<java.util.concurrent.Future<?>>();
                for (int i = 0; i < 4; i++) {
                    int call = i;
                    futures.add(workers.submit(() -> {
                        barrier.await();
                        CallEvent miss = call("miss-" + call, false, NOW.minusSeconds(40 - call));
                        first.applyCall(miss); second.applyCall(miss);
                        return true;
                    }));
                }
                for (var future : futures) future.get(15, TimeUnit.SECONDS);
            }
            assertEquals(CallPermissionStatus.REVOKED, store.find(NUMBER, CONTACT).orElseThrow().status());
            assertEquals(4, store.find(NUMBER, CONTACT).orElseThrow().consecutiveUnanswered());
            second.applyCall(call("connected-old", true, NOW.minusSeconds(60)));
            second.applyCall(call("miss-before-reset", false, NOW.minusSeconds(80)));
            assertEquals(4, store.find(NUMBER, CONTACT).orElseThrow().consecutiveUnanswered());
            second.applyReply(grant("grant-2", NOW.minusSeconds(10)));
            first.applyCall(call("miss-0", false, NOW.minusSeconds(40)));
            assertEquals(0, store.find(NUMBER, CONTACT).orElseThrow().consecutiveUnanswered());
            assertEquals(CallPermissionStatus.PERMANENT, store.find(NUMBER, CONTACT).orElseThrow().status());
            assertEquals(8, store.events(NUMBER, CONTACT).size());
            assertTrue(store.find("another-number", CONTACT).isEmpty());
            assertThrows(IllegalStateException.class, () -> store.locked(NUMBER, CONTACT, () -> {
                store.save(CallPermission.none(NUMBER, CONTACT));
                throw new IllegalStateException("Synthetic transition failure");
            }));
            assertEquals(CallPermissionStatus.PERMANENT, store.find(NUMBER, CONTACT).orElseThrow().status());
            store.recordRequest("acme", NUMBER, CONTACT, "rule", "wamid.once", null, NOW.minusSeconds(1));
            store.recordRequest("acme", NUMBER, CONTACT, "rule", "wamid.once", null, NOW);
            assertTrue(store.locked(NUMBER, CONTACT, () -> store.locked(NUMBER, CONTACT, () -> true)));
            assertEquals(List.of(NOW.minusSeconds(1)), store.requestsSince(NUMBER, CONTACT, NOW.minusSeconds(10)));
        } finally {
            pool.query("DROP SCHEMA " + schema + " CASCADE").execute().await().indefinitely();
            pool.closeAndAwait(); vertx.closeAndAwait();
        }
    }

    private static CallPermissionService service(CallPermissionStore store) {
        return new CallPermissionService(store, key -> Optional.empty(), (tenant, to) -> null,
                (tenant, number, to, name, lang, params) -> null, true, Clock.fixed(NOW, ZoneOffset.UTC));
    }
    private static CallPermissionReply grant(String id, Instant at) {
        return new CallPermissionReply(NUMBER, CONTACT, id, null, true, true, null, "user_action", at.atOffset(ZoneOffset.UTC));
    }
    private static CallEvent call(String id, boolean connected, Instant at) {
        return new CallEvent(NUMBER, id, CONTACT, "terminate", "BUSINESS_INITIATED", "COMPLETED", connected, at.atOffset(ZoneOffset.UTC));
    }
    private String resource(String file) throws Exception {
        try (var resource = getClass().getResourceAsStream("/db/migration/conversational/" + file)) {
            assertNotNull(resource); return new String(resource.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
