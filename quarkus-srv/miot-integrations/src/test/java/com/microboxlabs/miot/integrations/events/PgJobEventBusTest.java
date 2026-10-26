package com.microboxlabs.miot.integrations.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.smallrye.mutiny.helpers.test.AssertSubscriber;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "miot.integrations.test.pg-url", matches = ".+")
class PgJobEventBusTest {

    private Pool pool(Vertx vertx) {
        return PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.pg-url")))
                .with(new PoolOptions().setMaxSize(2)).using(vertx).build();
    }

    @Test
    void aWorkerPodPublishesFittedFramesToOnlyItsTenantsApiStream() throws Exception {
        Vertx vertx = Vertx.vertx();
        Pool workerPool = pool(vertx);
        Pool apiPool = pool(vertx);
        JobEventBus worker = new JobEventBus(() -> workerPool, vertx, true);
        JobEventBus api = new JobEventBus(() -> apiPool, vertx, true);
        AssertSubscriber<JsonObject> mine = api.stream("cert-tenant-a")
                .filter(f -> JobEventEmitter.EVENT_TYPE.equals(f.getString("eventType")))
                .subscribe().withSubscriber(AssertSubscriber.create(10));
        AssertSubscriber<JsonObject> other = api.stream("cert-tenant-b")
                .filter(f -> JobEventEmitter.EVENT_TYPE.equals(f.getString("eventType")))
                .subscribe().withSubscriber(AssertSubscriber.create(10));
        try {
            worker.start().toCompletableFuture().get(5, TimeUnit.SECONDS);
            api.start().toCompletableFuture().get(5, TimeUnit.SECONDS);
            JsonObject frame = new JsonObject().put("eventType", JobEventEmitter.EVENT_TYPE)
                    .put("tenantId", "cert-tenant-a").put("payload", new JsonObject()
                            .put("jobId", "cert-job-utf8").put("lastError", "界".repeat(3000)));
            worker.publish(frame);
            mine.awaitItems(1, Duration.ofSeconds(5));
            assertEquals("cert-job-utf8", mine.getItems().get(0).getJsonObject("payload").getString("jobId"));
            assertNull(mine.getItems().get(0).getJsonObject("payload").getString("lastError"));
            assertTrue(other.getItems().isEmpty());
            assertEquals("界".repeat(3000), frame.getJsonObject("payload").getString("lastError"));
        } finally {
            mine.cancel();
            other.cancel();
            worker.stop();
            api.stop();
            workerPool.closeAndAwait();
            apiPool.closeAndAwait();
            vertx.closeAndAwait();
        }
    }
}
