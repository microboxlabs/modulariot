package com.microboxlabs.miot.integrations.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.core.db.Transactions;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "miot.integrations.test.pg-url", matches = ".+")
class PgJobEventEmitterTest {

    private final List<JsonObject> frames = new ArrayList<>();
    private Vertx vertx;
    private Pool pool;
    private JobEventBus bus;
    private JobEventEmitter emitter;
    private Transactions tx;

    @BeforeEach
    void setUp() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.pg-url")))
                .using(vertx).build();
        tx = new PgTransactions(() -> pool);
        bus = new JobEventBus(() -> pool, vertx, true) {
            @Override
            public void publish(JsonObject frame) {
                frames.add(frame);
            }
        };
        emitter = new JobEventEmitter(Optional.empty(), bus);
    }

    @AfterEach
    void cleanUp() {
        bus.stop();
        pool.closeAndAwait();
        vertx.closeAndAwait();
    }

    @Test
    void aTransitionIsNotPublishedBeforeItsTransactionCommits() {
        tx.inTransaction(() -> {
            emitter.emit(JobEventEmitterTest.job(), "enqueued");
            assertTrue(frames.isEmpty(), "the ledger transaction is still uncommitted");
        });
        assertEquals(List.of("enqueued"), transitions());
    }

    @Test
    void aRollbackDoesNotPublishAPhantomTransition() {
        assertThrows(IllegalStateException.class, () -> tx.inTransaction(() -> {
            emitter.emit(JobEventEmitterTest.job(), "enqueued");
            throw new IllegalStateException("test rollback");
        }));
        assertTrue(frames.isEmpty());
    }

    @Test
    void aFailedSavepointDropsOnlyItsOwnTransitions() {
        tx.inTransaction(() -> {
            emitter.emit(JobEventEmitterTest.job(), "enqueued");
            assertThrows(IllegalStateException.class, () -> PgTx.savepoint(() -> {
                emitter.emit(JobEventEmitterTest.job(), "failed");
                throw new IllegalStateException("test savepoint rollback");
            }));
            emitter.emit(JobEventEmitterTest.job(), "claimed");
            assertTrue(frames.isEmpty());
        });
        assertEquals(List.of("enqueued", "claimed"), transitions());
    }

    private List<String> transitions() {
        return frames.stream().map(frame -> frame.getJsonObject("payload").getString("transition")).toList();
    }
}
