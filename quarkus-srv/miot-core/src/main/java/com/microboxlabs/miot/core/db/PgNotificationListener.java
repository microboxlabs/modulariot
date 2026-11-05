package com.microboxlabs.miot.core.db;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgConnection;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.SqlConnection;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.jboss.logging.Logger;

/** One leased PostgreSQL LISTEN connection, with reconnect and explicit cleanup before returning it to the pool. */
public final class PgNotificationListener implements AutoCloseable {

    private static final Logger LOG = Logger.getLogger(PgNotificationListener.class);
    private final Supplier<Pool> pool;
    private final Vertx vertx;
    private final String channel;
    private final Consumer<String> consumer;
    private final long retryMillis;
    private final CompletableFuture<Void> ready = new CompletableFuture<>();
    private SqlConnection connection;
    private long retryTimer = -1;
    private boolean started;
    private boolean connecting;
    private boolean closed;

    public PgNotificationListener(Supplier<Pool> pool, Vertx vertx, String channel, Consumer<String> consumer) {
        this(pool, vertx, channel, consumer, Duration.ofSeconds(5));
    }

    PgNotificationListener(Supplier<Pool> pool, Vertx vertx, String channel, Consumer<String> consumer,
            Duration retryDelay) {
        if (!channel.matches("[a-z_][a-z0-9_]{0,62}") || retryDelay.toMillis() < 1) {
            throw new IllegalArgumentException("Invalid notification channel or retry delay");
        }
        this.pool = pool;
        this.vertx = vertx;
        this.channel = channel;
        this.consumer = consumer;
        this.retryMillis = retryDelay.toMillis();
    }

    /** Idempotent. Completes after the first successful LISTEN, retrying connection failures until closed. */
    public synchronized CompletionStage<Void> start() {
        if (closed) {
            return CompletableFuture.failedFuture(new IllegalStateException("Notification listener is closed"));
        }
        if (!started) {
            started = true;
            connect();
        }
        return ready.copy();
    }

    private synchronized void connect() {
        if (closed || connecting || connection != null) {
            return;
        }
        connecting = true;
        try {
            pool.get().getConnection().subscribe().with(this::connected, this::connectionFailed);
        } catch (RuntimeException failure) {
            connectionFailed(failure);
        }
    }

    private synchronized void connected(SqlConnection acquired) {
        connecting = false;
        if (closed) {
            release(acquired);
            return;
        }
        connection = acquired;
        try {
            PgConnection pg = PgConnection.cast(acquired);
            pg.notificationHandler(notice -> receive(acquired, notice.getPayload()));
            pg.closeHandler(() -> disconnected(acquired, new IllegalStateException("Connection closed")));
            pg.query("LISTEN " + channel).execute().subscribe().with(
                    ignored -> listening(acquired), failure -> disconnected(acquired, failure));
        } catch (RuntimeException failure) {
            disconnected(acquired, failure);
        }
    }

    private synchronized void listening(SqlConnection acquired) {
        if (!closed && connection == acquired) {
            ready.complete(null);
        }
    }

    private void receive(SqlConnection acquired, String payload) {
        synchronized (this) {
            if (closed || connection != acquired) {
                return;
            }
        }
        try {
            consumer.accept(payload);
        } catch (RuntimeException failure) {
            LOG.debugf("Notification on %s ignored: %s", channel, failure.getMessage());
        }
    }

    private synchronized void disconnected(SqlConnection acquired, Throwable failure) {
        if (connection != acquired) {
            return;
        }
        connection = null;
        release(acquired);
        retry(failure);
    }

    private synchronized void connectionFailed(Throwable failure) {
        connecting = false;
        retry(failure);
    }

    private void retry(Throwable failure) {
        if (closed || retryTimer != -1) {
            return;
        }
        LOG.warnf("Notification listener %s reconnecting: %s", channel, failure.getMessage());
        retryTimer = vertx.setTimer(retryMillis, ignored -> retry());
    }

    private synchronized void retry() {
        retryTimer = -1;
        connect();
    }

    @Override
    public synchronized void close() {
        closed = true;
        if (retryTimer != -1) {
            vertx.cancelTimer(retryTimer);
            retryTimer = -1;
        }
        ready.cancel(false);
        SqlConnection acquired = connection;
        connection = null;
        if (acquired != null) {
            release(acquired);
        }
    }

    private void release(SqlConnection acquired) {
        try {
            PgConnection pg = PgConnection.cast(acquired);
            pg.notificationHandler(null);
            pg.closeHandler(null);
            pg.query("UNLISTEN " + channel).execute().onFailure().recoverWithNull()
                    .chain(ignored -> acquired.close()).subscribe().with(ignored -> { },
                            failure -> LOG.debugf("Notification listener %s cleanup: %s", channel, failure.getMessage()));
        } catch (RuntimeException failure) {
            LOG.debugf("Notification listener %s cleanup: %s", channel, failure.getMessage());
            acquired.closeAndForget();
        }
    }
}
