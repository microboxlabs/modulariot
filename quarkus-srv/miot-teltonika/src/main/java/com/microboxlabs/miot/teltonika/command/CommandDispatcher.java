package com.microboxlabs.miot.teltonika.command;

import com.microboxlabs.miot.teltonika.device.DeviceRegistry;
import com.microboxlabs.miot.teltonika.server.Receiver.CommandCallbacks;
import com.microboxlabs.miot.teltonika.server.SessionRegistry;
import com.microboxlabs.miot.teltonika.service.ActivationService;
import com.microboxlabs.miot.teltonika.store.ClusterLock;
import io.vertx.core.Vertx;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.jboss.logging.Logger;

/**
 * Delivers pending commands to the devices connected to this receiver instance. Commands live in
 * the database, so whichever instance holds a device's session sends them. A command is claimed in
 * the database (pending → sent) before it is written to the socket, so two instances never send the
 * same one; a claim the session could not take now (busy) is released for the next round.
 * Housekeeping (expiry, intensive-tracking end and restore retries) runs in one instance at a time.
 * {@link #tick} is blocking: it runs on a worker, never on the event loop.
 */
public final class CommandDispatcher implements CommandCallbacks {

    private static final Logger LOG = Logger.getLogger(CommandDispatcher.class);
    private static final int BATCH = 200;

    private final CommandStore store;
    private final CommandService service;
    private final ActivationService activation;
    private final DeviceRegistry registry;
    private final SessionRegistry sessions;
    private final ClusterLock lock;
    private final Vertx vertx;
    private final Clock clock;

    public CommandDispatcher(CommandStore store, CommandService service, ActivationService activation,
            DeviceRegistry registry, SessionRegistry sessions, ClusterLock lock, Vertx vertx, Clock clock) {
        this.store = store;
        this.service = service;
        this.activation = activation;
        this.registry = registry;
        this.sessions = sessions;
        this.lock = lock;
        this.vertx = vertx;
        this.clock = clock;
    }

    public void tick() {
        lock.runExclusively("command-housekeeping", () -> {
            service.endDue();
            store.expire(now());
            service.retryRestores();
        });
        var connected = sessions.connectedImeis();
        if (connected.isEmpty()) {
            return;
        }
        for (String imei : connected) {
            registry.find(imei).filter(d -> !d.activated()).ifPresent(activation::requestCheck);
        }
        for (DeviceCommand c : store.pending(connected, now(), BATCH)) {
            var session = sessions.find(c.imei());
            if (session.isEmpty() || !store.markSent(c.id(), now())) {
                continue;
            }
            try {
                boolean sent = session.get().offerCommand(c.id(), c.command())
                        .toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
                if (!sent) {
                    store.release(c.id());
                }
            } catch (Exception e) {
                LOG.warnf(e, "Command %s could not be sent to imei=%s", c.id(), c.imei());
                store.markFailed(c.id(), "could not be sent: " + e.getMessage(), now());
            }
        }
    }

    @Override
    public void answered(UUID commandId, String response) {
        vertx.executeBlocking(() -> {
            store.markAnswered(commandId, response, now());
            store.find(commandId).ifPresent(c -> {
                if (DeviceCommand.ACTIVATION.equals(c.purpose())) {
                    activation.answered(c, response);
                } else {
                    service.answered(c, response);
                }
            });
            return null;
        }, false).onFailure(e -> LOG.warnf(e, "Could not process the response of command %s", commandId));
    }

    @Override
    public void failed(UUID commandId, String reason) {
        vertx.executeBlocking(() -> {
            store.markFailed(commandId, reason, now());
            return null;
        }, false).onFailure(e -> LOG.warnf(e, "Could not save the failure of command %s", commandId));
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }
}
