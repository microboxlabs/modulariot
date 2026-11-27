package com.microboxlabs.miot.teltonika;

import com.microboxlabs.miot.core.config.IMiotComponent;
import com.microboxlabs.miot.core.messaging.IMessagePublisher;
import com.microboxlabs.miot.core.messaging.LogMessagePublisher;
import com.microboxlabs.miot.teltonika.catalog.ChannelRules;
import com.microboxlabs.miot.teltonika.catalog.ModelCatalog;
import com.microboxlabs.miot.teltonika.command.CommandDispatcher;
import com.microboxlabs.miot.teltonika.command.CommandService;
import com.microboxlabs.miot.teltonika.command.CommandStore;
import com.microboxlabs.miot.teltonika.config.TeltonikaConfig;
import com.microboxlabs.miot.teltonika.device.CachedDeviceRegistry;
import com.microboxlabs.miot.teltonika.device.DeviceBootstrap;
import com.microboxlabs.miot.teltonika.device.DeviceStore;
import com.microboxlabs.miot.teltonika.ingest.RecordSink;
import com.microboxlabs.miot.teltonika.monitor.DeviceMonitor;
import com.microboxlabs.miot.teltonika.monitor.MonitorStore;
import com.microboxlabs.miot.teltonika.server.MqttReceiver;
import com.microboxlabs.miot.teltonika.server.PublishGate;
import com.microboxlabs.miot.teltonika.server.Receiver;
import com.microboxlabs.miot.teltonika.server.SessionRegistry;
import com.microboxlabs.miot.teltonika.server.TeltonikaMetrics;
import com.microboxlabs.miot.teltonika.server.TeltonikaTcpServer;
import com.microboxlabs.miot.teltonika.server.TeltonikaUdpServer;
import com.microboxlabs.miot.teltonika.service.ActivationService;
import com.microboxlabs.miot.teltonika.store.ClusterLock;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.arc.ClientProxy;
import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.core.Vertx;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

/**
 * Teltonika receiver: TCP listener for Codec 8 / Codec 8 Extended devices registered by the
 * organizations, plus its periodic work (registry refresh, status writes, command delivery,
 * intensive-tracking housekeeping, packet-log retention). Records go to the same positions topic as
 * {@code /v1/asset/track}. See README.md of this module.
 *
 * <p>Present only in builds with the component; started only when enabled at runtime. It is not part
 * of {@code miot.component.all.enabled}: it runs in its own deployment. Its readiness is the health
 * group {@code teltonika} ({@link ReceiverReadiness}); the component's own check reports its state as
 * data and stays UP, so it never takes down other components sharing a pod.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
@LookupIfProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class TeltonikaComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(TeltonikaComponent.class);
    private static final String NOT_CONFIGURED = "not-configured";

    private final Vertx vertx;
    private final TeltonikaConfig config;
    private final IMessagePublisher publisher;
    private final DeviceStore deviceStore;
    private final MonitorStore monitorStore;
    private final CommandService commandService;
    private final CachedDeviceRegistry registry;
    private final DeviceMonitor monitor;
    private final ClusterLock lock;
    private final CommandDispatcher dispatcher;
    private final ActivationService activation;
    private final TeltonikaTcpServer server;
    private final TeltonikaUdpServer udp;
    private final MqttReceiver mqtt;
    private final List<Long> timers = new ArrayList<>();
    private final AtomicBoolean ready = new AtomicBoolean();
    private volatile long loadTimer = -1;
    private volatile String state = "starting";
    /** Channels already started (only touched by the registry-load timer, one run at a time). */
    private volatile boolean tcpStarted;
    private volatile boolean udpStarted;
    private volatile boolean mqttStarted;

    TeltonikaComponent(Vertx vertx, TeltonikaConfig config, IMessagePublisher publisher, DeviceStore deviceStore,
            MonitorStore monitorStore, CommandStore commandStore, CommandService commandService,
            ActivationService activation, CachedDeviceRegistry registry, DeviceMonitor monitor,
            SessionRegistry sessions, RecordSink sink, ClusterLock lock, MeterRegistry meterRegistry,
            ModelCatalog catalog) {
        this.vertx = vertx;
        this.config = config;
        this.publisher = publisher;
        this.deviceStore = deviceStore;
        this.monitorStore = monitorStore;
        this.commandService = commandService;
        this.registry = registry;
        this.monitor = monitor;
        this.lock = lock;
        this.activation = activation;
        this.dispatcher = new CommandDispatcher(commandStore, commandService, activation, registry, sessions, lock,
                vertx, Clock.systemUTC());
        var metrics = new TeltonikaMetrics(meterRegistry);
        var gate = new PublishGate(config.maxInFlightRecords());
        metrics.gauge("miot.teltonika.publish.in_flight", gate::inFlight);
        metrics.gauge("miot.teltonika.publish.waiting", gate::waiting);
        metrics.gauge("miot.teltonika.registry.devices", registry::size);
        metrics.gauge("miot.teltonika.packet_log.dropped", monitor::droppedPackets);
        metrics.gauge("miot.teltonika.sessions.open", sessions::size);
        int instances = config.instances() > 0 ? config.instances() : Runtime.getRuntime().availableProcessors();
        var settings = new Receiver.Settings(config.host(), config.port(), config.idleTimeout(),
                config.handshakeTimeout(), config.maxConnectionsPerIp(), config.acceptBacklog(), instances,
                config.publishTimeout(), config.commandTimeout(), config.logRawPackets(),
                new Receiver.Tls(config.tlsCertPath().orElse(null), config.tlsKeyPath().orElse(null)));
        // The native receivers only hear devices of native models (see ChannelRules).
        var receiver = new Receiver(vertx, settings, ChannelRules.nativeView(registry, catalog), sink, monitor, metrics,
                sessions, gate, dispatcher);
        this.server = new TeltonikaTcpServer(receiver);
        this.udp = config.udpPort().map(port -> new TeltonikaUdpServer(receiver, port)).orElse(null);
        var m = config.mqtt();
        this.mqtt = !m.enabled() ? null : new MqttReceiver(receiver, new MqttReceiver.Settings(m.host(), m.port(),
                m.tls(), m.caPath().orElse(null), m.certPath().orElse(null), m.keyPath().orElse(null), m.clientId(),
                m.username().orElse(null), m.password().orElse(null), m.dataTopicFilter(), m.commandTopic(),
                m.reconnectDelay(), m.linkIdle()));
    }

    @Override
    public String name() {
        return "teltonika";
    }

    @Override
    public int priority() {
        return 250;
    }

    @Override
    public void onStart() {
        requireBroker();
        // Components start before the modulith migrates its schemas: the registry loads in the
        // background, retrying until miot_teltonika exists. The listener opens only after that, so no
        // device is refused just because the registry was not loaded yet.
        loadTimer = every(Duration.ofSeconds(2), "registry load", this::loadRegistryOnce);
        LOG.info("Teltonika component started; loading the device registry before listening");
    }

    /** Refuses to run where every packet would be acknowledged and lost. */
    private void requireBroker() {
        if (!config.requireBroker()) {
            return;
        }
        Object target = ClientProxy.unwrap(publisher);
        if (target instanceof LogMessagePublisher) {
            throw new IllegalStateException("Teltonika receiver needs a message broker: set MIOT_MESSAGING_TYPE=pulsar"
                    + " (or miot.teltonika.require-broker=false only for local development)");
        }
        String topic = config.topic();
        if (topic == null || topic.isBlank() || NOT_CONFIGURED.equals(topic)) {
            throw new IllegalStateException("Teltonika receiver needs miot.teltonika.topic (MIOT_TELTONIKA_TOPIC or"
                    + " MIOT_TRACKING_TOPIC)");
        }
    }

    private void loadRegistryOnce() {
        if (ready.get()) {
            return;
        }
        try {
            DeviceBootstrap.apply(deviceStore, config.bootstrapDevices());
        } catch (RuntimeException e) {
            state = "waiting for the miot_teltonika schema";
            LOG.debugf("Device registry not available yet: %s", e.getMessage());
            return;
        }
        int devices = registry.reload();
        if (devices < 0) {
            return;
        }
        // Each channel starts once: a retry only starts what is not running yet, so a failing
        // optional channel never deploys the TCP listeners twice.
        try {
            if (!tcpStarted) {
                server.start().toCompletionStage().toCompletableFuture().get(10, TimeUnit.SECONDS);
                tcpStarted = true;
            }
            if (udp != null && !udpStarted) {
                udp.start().toCompletionStage().toCompletableFuture().get(10, TimeUnit.SECONDS);
                udpStarted = true;
            }
            if (mqtt != null && !mqttStarted) {
                // The broker is not waited for: the receiver keeps connecting in the background and
                // its state is in the health data. TCP and UDP do not depend on it.
                mqttStarted = true;
                mqtt.start().onFailure(e -> LOG.errorf(e, "MQTT receiver could not start"));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        } catch (Exception e) {
            state = "listener could not start: " + e.getMessage();
            LOG.errorf(e, "Teltonika listener could not start; retrying");
            return;
        }
        ready.set(true);
        state = "listening";
        vertx.cancelTimer(loadTimer);
        every(config.registryRefresh(), "registry refresh", registry::reload);
        every(config.monitorFlush(), "status flush", monitor::flush);
        every(config.commandPoll(), "command delivery", dispatcher::tick);
        every(Duration.ofMinutes(1), "pending packets replay", () -> lock.runExclusively("pending-replay",
                activation::replayLeftovers));
        every(Duration.ofHours(1), "packet log retention", () -> lock.runExclusively("packet-log-retention",
                () -> monitorStore.applyRetention(OffsetDateTime.now(ZoneOffset.UTC).minus(config.packetRetention()))));
        if (devices == 0) {
            LOG.warn("No active Teltonika devices registered: every connection is refused until one is added");
        }
        LOG.infof("Teltonika receiver ready: %d active devices", devices);
    }

    @Override
    public void onStop() {
        ready.set(false);
        state = "stopping";
        timers.forEach(vertx::cancelTimer);
        try {
            if (mqtt != null) {
                mqtt.stop().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
            }
            if (udp != null) {
                udp.stop().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            LOG.warnf(e, "Teltonika UDP/MQTT receivers did not stop cleanly");
        }
        try {
            server.stop(config.shutdownGrace()).toCompletionStage().toCompletableFuture()
                    .get(config.shutdownGrace().toSeconds() + 5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            LOG.warnf(e, "Teltonika receiver did not stop cleanly");
        }
        monitor.flush();
        LOG.info("Teltonika component stopped");
    }

    /** UP with the receiver's state as data: never takes down the other components of the pod. */
    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named("teltonika").up()
                .withData("state", state)
                .withData("listening", server.isListening())
                .withData("devices", registry.size())
                .withData("udp", udp != null)
                .withData("mqtt", mqtt == null ? "off" : mqtt.connected() ? "connected" : "reconnecting")
                .build();
    }

    /** Whether the receiver accepts devices: the readiness of its own deployment. */
    public boolean ready() {
        return ready.get() && server.isListening();
    }

    public Map<String, Object> describe() {
        return Map.of("state", state, "port", server.port(), "devices", registry.size());
    }

    /** Periodic blocking work on a worker; one run at a time per job. */
    private long every(Duration period, String name, Runnable work) {
        AtomicBoolean running = new AtomicBoolean();
        long id = vertx.setPeriodic(period.toMillis(), tick -> {
            if (!running.compareAndSet(false, true)) {
                return;
            }
            vertx.executeBlocking(() -> {
                work.run();
                return null;
            }, false).onComplete(ar -> {
                running.set(false);
                if (ar.failed()) {
                    LOG.warnf(ar.cause(), "Teltonika %s failed", name);
                }
            });
        });
        timers.add(id);
        return id;
    }
}
