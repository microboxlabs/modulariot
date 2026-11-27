package com.microboxlabs.miot.teltonika.server;

import io.vertx.core.AbstractVerticle;
import io.vertx.core.DeploymentOptions;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.net.NetServer;
import io.vertx.core.net.NetServerOptions;
import io.vertx.core.net.NetSocket;
import io.vertx.core.net.PemKeyCertOptions;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.jboss.logging.Logger;

/**
 * TCP listener for Teltonika devices, deployed as {@code instances} verticles: each one is a server
 * on its own event loop sharing the port, so connections spread over several cores (a single server
 * would put every session on one thread). Each connection gets its own {@link DeviceSession}.
 * Connections per source address are capped.
 *
 * <p>{@link #stop} drains: it refuses new connections, stops reading new packets, waits for the
 * packets in progress to be acknowledged, then closes the sessions and the listeners.
 */
public final class TeltonikaTcpServer {

    private static final Logger LOG = Logger.getLogger(TeltonikaTcpServer.class);
    private static final long DRAIN_POLL_MS = 100;

    private final Receiver rx;
    private final SampledLog sampled = new SampledLog(LOG, 5, Duration.ofMinutes(1));
    private final Map<String, AtomicInteger> perIp = new ConcurrentHashMap<>();
    private final AtomicBoolean draining = new AtomicBoolean();
    private final AtomicInteger port = new AtomicInteger();
    private volatile String deploymentId;

    public TeltonikaTcpServer(Receiver rx) {
        this.rx = rx;
    }

    /**
     * Starts listening; completes with the bound port. All instances ask for the same port so Vert.x
     * shares it among them; port 0 (any free port) is only possible with a single instance.
     */
    public Future<Integer> start() {
        int instances = Math.max(1, rx.settings().instances());
        if (rx.settings().port() == 0 && instances > 1) {
            return Future.failedFuture(new IllegalArgumentException("port 0 needs a single listener instance"));
        }
        return rx.vertx().deployVerticle(() -> new ListenerVerticle(this),
                        new DeploymentOptions().setInstances(instances))
                .map(id -> {
                    deploymentId = id;
                    LOG.infof("Teltonika receiver listening on %s:%d with %d event loop(s)%s", rx.settings().host(),
                            port.get(), instances, rx.settings().tls().enabled() ? " (TLS)" : "");
                    return port.get();
                });
    }

    /** One server on its own event loop. */
    private static final class ListenerVerticle extends AbstractVerticle {

        private final TeltonikaTcpServer owner;

        ListenerVerticle(TeltonikaTcpServer owner) {
            this.owner = owner;
        }

        @Override
        public void start(Promise<Void> started) {
            Receiver.Settings s = owner.rx.settings();
            var options = new NetServerOptions()
                    .setHost(s.host())
                    .setPort(s.port())
                    .setTcpKeepAlive(true)
                    .setAcceptBacklog(s.acceptBacklog())
                    .setIdleTimeout((int) s.idleTimeout().toSeconds())
                    .setIdleTimeoutUnit(TimeUnit.SECONDS);
            if (s.tls().enabled()) {
                options.setSsl(true).setKeyCertOptions(new PemKeyCertOptions()
                        .setCertPath(s.tls().certPath()).setKeyPath(s.tls().keyPath()));
            }
            NetServer server = vertx.createNetServer(options);
            server.connectHandler(owner::accept);
            server.listen().onSuccess(srv -> {
                owner.port.compareAndSet(0, srv.actualPort());
                started.complete();
            }).onFailure(started::fail);
        }
    }

    private void accept(NetSocket socket) {
        if (draining.get()) {
            socket.close();
            return;
        }
        String ip = socket.remoteAddress() == null ? "?" : socket.remoteAddress().host();
        AtomicInteger count = perIp.computeIfAbsent(ip, k -> new AtomicInteger());
        if (count.incrementAndGet() > rx.settings().maxConnectionsPerIp()) {
            count.decrementAndGet();
            rx.metrics().ipLimited();
            sampled.warn("ip:" + ip, "Connection limit reached for " + ip + ", refusing");
            socket.close();
            return;
        }
        Runnable released = () -> {
            if (count.decrementAndGet() <= 0) {
                perIp.remove(ip, count);
            }
        };
        new DeviceSession(socket, rx.vertx().getOrCreateContext(), rx, sampled, released).start();
    }

    /**
     * Refuses new connections, stops reading, waits up to {@code grace} for the packets in progress,
     * then closes the sessions and the listeners.
     */
    public Future<Void> stop(Duration grace) {
        if (deploymentId == null) {
            return Future.succeededFuture();
        }
        draining.set(true);
        tcpSessions().forEach(DeviceSession::pauseReading);
        Promise<Void> drained = Promise.promise();
        waitDrained(System.nanoTime() + grace.toNanos(), drained);
        return drained.future().compose(v -> {
            var open = tcpSessions();
            open.forEach(DeviceSession::close);
            LOG.infof("Teltonika receiver stopped: %d sessions closed, %d records still in flight", open.size(),
                    rx.gate().inFlight());
            return rx.vertx().undeploy(deploymentId).onComplete(x -> deploymentId = null);
        });
    }

    private void waitDrained(long deadline, Promise<Void> done) {
        if (rx.gate().inFlight() == 0 || System.nanoTime() > deadline) {
            done.complete();
            return;
        }
        rx.vertx().setTimer(DRAIN_POLL_MS, t -> waitDrained(deadline, done));
    }

    private java.util.List<DeviceSession> tcpSessions() {
        return rx.sessions().sessions().stream().filter(DeviceSession.class::isInstance)
                .map(DeviceSession.class::cast).toList();
    }

    public boolean isListening() {
        return deploymentId != null && !draining.get();
    }

    public int port() {
        return port.get();
    }
}
