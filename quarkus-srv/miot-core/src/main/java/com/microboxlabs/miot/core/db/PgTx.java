package com.microboxlabs.miot.core.db;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.SqlClient;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.pgclient.PgException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import org.jboss.logging.Logger;

/**
 * Blocking transactions over the reactive Postgres client. {@link #inTransaction} binds one
 * connection to the calling thread; every store query that goes through {@link #client} joins it.
 * BEGIN/COMMIT are plain statements, not a Vert.x {@code Transaction}, which rolls everything back
 * on the first failed statement, even one inside a savepoint. Blocking: call it off the event loop.
 */
public final class PgTx {

    public static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Logger LOG = Logger.getLogger(PgTx.class);
    /** Shorter than {@link #TIMEOUT}, so a lock wait fails in Postgres (55P03) before the client gives up. */
    private static final Duration LOCK_TIMEOUT = Duration.ofSeconds(5);

    private static final ThreadLocal<Tx> TX = new ThreadLocal<>();

    private static final class Tx {
        private final SqlConnection conn;
        private final List<Runnable> afterCommit = new ArrayList<>();
        private final List<Runnable> afterRollback = new ArrayList<>();
        private int savepoints;
        private boolean failed;

        private Tx(SqlConnection conn) {
            this.conn = conn;
        }
    }

    private PgTx() {
    }

    /** The open transaction's connection, or {@code fallback} outside one. */
    public static SqlClient client(SqlClient fallback) {
        Tx tx = TX.get();
        return tx == null ? fallback : tx.conn;
    }

    /** Records a failed statement: outside a savepoint it leaves the transaction unable to commit. */
    public static void statementFailed() {
        Tx tx = TX.get();
        if (tx != null && tx.savepoints == 0) {
            tx.failed = true;
        }
    }

    /**
     * Runs {@code action} once the open transaction commits, and drops it when the transaction or the savepoint it
     * was queued in rolls back. Outside a transaction it runs now. A failing action is logged and the others run.
     */
    public static void afterCommit(Runnable action) {
        Tx tx = TX.get();
        if (tx == null) {
            runQuietly(action);
        } else {
            tx.afterCommit.add(action);
        }
    }

    /** Compensates external work if this transaction or its current savepoint rolls back. */
    public static void afterRollback(Runnable action) {
        Tx tx = TX.get();
        if (tx != null) {
            tx.afterRollback.add(action);
        }
    }

    private static void runQuietly(Runnable action) {
        try {
            action.run();
        } catch (RuntimeException e) {
            LOG.warnf(e, "A transaction completion action failed");
        }
    }

    /** {@code " FOR UPDATE"} inside a transaction: a row read there stays locked until it ends. */
    public static String lock() {
        return TX.get() == null ? "" : " FOR UPDATE";
    }

    /**
     * Runs {@code work} in one transaction: commits when it returns, rolls back otherwise. A nested
     * call joins the outer transaction.
     */
    public static <T> T inTransaction(Pool pool, Supplier<T> work) {
        if (TX.get() != null) {
            return work.get();
        }
        SqlConnection conn = pool.getConnection().await().atMost(TIMEOUT);
        boolean committed = false;
        Tx tx = null;
        try {
            simple(conn, "BEGIN");
            simple(conn, "SET LOCAL lock_timeout = '" + LOCK_TIMEOUT.toMillis() + "ms'");
            tx = new Tx(conn);
            TX.set(tx);
            T result = work.get();
            TX.remove();
            if (tx.failed) {
                throw new IllegalStateException("a statement failed in the transaction");
            }
            simple(conn, "COMMIT");
            committed = true;
            tx.afterCommit.forEach(PgTx::runQuietly);
            return result;
        } finally {
            TX.remove();
            if (!committed) {
                rollbackQuietly(conn);
                if (tx != null) {
                    compensate(tx, 0);
                }
            }
            conn.close().await().atMost(TIMEOUT);
        }
    }

    /**
     * Inside a transaction, runs {@code work} under a savepoint: when it throws, only its own
     * statements are undone and the transaction stays usable. Outside one, just runs it.
     */
    public static <T> T savepoint(Supplier<T> work) {
        Tx tx = TX.get();
        if (tx == null) {
            return work.get();
        }
        String name = "miot_sp" + tx.savepoints;
        simple(tx.conn, "SAVEPOINT " + name);
        tx.savepoints++;
        int queued = tx.afterCommit.size();
        int compensations = tx.afterRollback.size();
        T result;
        try {
            result = work.get();
        } catch (RuntimeException e) {
            tx.savepoints--;
            simple(tx.conn, "ROLLBACK TO SAVEPOINT " + name);
            tx.afterCommit.subList(queued, tx.afterCommit.size()).clear();
            compensate(tx, compensations);
            throw e;
        }
        tx.savepoints--;
        simple(tx.conn, "RELEASE SAVEPOINT " + name);
        return result;
    }

    private static void compensate(Tx tx, int from) {
        List<Runnable> actions = new ArrayList<>(tx.afterRollback.subList(from, tx.afterRollback.size()));
        tx.afterRollback.subList(from, tx.afterRollback.size()).clear();
        for (int i = actions.size() - 1; i >= 0; i--) {
            runQuietly(actions.get(i));
        }
    }

    private static void simple(SqlConnection conn, String sql) {
        try {
            conn.query(sql).execute().await().atMost(TIMEOUT);
        } catch (PgException e) {
            throw conflictOr(e);
        }
    }

    private static void rollbackQuietly(SqlConnection conn) {
        try {
            conn.query("ROLLBACK").execute().await().atMost(TIMEOUT);
        } catch (RuntimeException ignored) {
            // the connection is closed right after; a failed rollback leaves nothing to keep
        }
    }

    /** A serialization failure, deadlock or lock timeout is a 409 the caller may retry. */
    public static RuntimeException conflictOr(PgException e) {
        return switch (e.getSqlState() == null ? "" : e.getSqlState()) {
            case "40001", "40P01", "55P03" -> new IllegalStateException("conflict: a concurrent change won, retry");
            default -> e;
        };
    }
}
