package com.microboxlabs.miot.integrations.orgaccount;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "miot.integrations.test.pg-url", matches = ".+")
class PgOrgServiceAccountRepositoryTest {
    @Test
    void concurrentCreationReturnsTheWinningAccountAndPreservesItsAudit() throws Exception {
        Vertx vertx = Vertx.vertx();
        Pool pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.pg-url")))
                .with(new PoolOptions().setMaxSize(3)).using(vertx).build();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String tenant = "cert-org-" + suffix;
        try (var workers = Executors.newFixedThreadPool(2)) {
            pool.query("CREATE SCHEMA IF NOT EXISTS miot_integrations").execute().await().atMost(Duration.ofSeconds(5));
            var exists = pool.query("SELECT to_regclass('miot_integrations.org_service_accounts')::text")
                    .execute().await().atMost(Duration.ofSeconds(5)).iterator().next().getString(0);
            if (exists == null) {
                try (var sql = getClass().getResourceAsStream("/db/migration/integrations/V0.6.31__org_service_accounts.sql")) {
                    assertNotNull(sql);
                    pool.query(new String(sql.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(Duration.ofSeconds(5));
                }
            }
            OrgServiceAccountRepository repository = new OrgServiceAccountRepository(pool);
            var first = workers.submit(() -> repository.insert(account(tenant, suffix, "first")));
            var second = workers.submit(() -> repository.insert(account(tenant, suffix, "second")));
            OrgServiceAccount winner = first.get(5, TimeUnit.SECONDS);
            assertEquals(winner, second.get(5, TimeUnit.SECONDS));
            OrgServiceAccount retry = repository.insert(account(tenant, suffix + "x", "retry"));
            assertEquals(winner, retry);
            assertEquals(winner.createdBy(), retry.updatedBy());
        } finally {
            pool.preparedQuery("DELETE FROM miot_integrations.org_service_accounts WHERE tenant_code = $1")
                    .execute(Tuple.of(tenant)).await().atMost(Duration.ofSeconds(5));
            pool.closeAndAwait();
            vertx.closeAndAwait();
        }
    }

    private static OrgServiceAccount account(String tenant, String suffix, String actor) {
        return new OrgServiceAccount(tenant, "project-demo", "t-" + suffix,
                "t-" + suffix + "@project-demo.iam.gserviceaccount.com", suffix, false,
                null, actor, null, actor);
    }
}
