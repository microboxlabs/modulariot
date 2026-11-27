package com.microboxlabs.miot.teltonika.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.protocol.AvlPacket;
import com.microboxlabs.miot.teltonika.protocol.Codec12;
import com.microboxlabs.miot.teltonika.protocol.CodecJson;
import com.microboxlabs.miot.teltonika.protocol.CodecParser;
import com.microboxlabs.miot.teltonika.protocol.ProtocolException;
import io.netty.handler.codec.mqtt.MqttQoS;
import io.vertx.core.Context;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.net.PemKeyCertOptions;
import io.vertx.core.net.PemTrustOptions;
import io.vertx.mqtt.MqttClient;
import io.vertx.mqtt.MqttClientOptions;
import io.vertx.mqtt.messages.MqttPublishMessage;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jboss.logging.Logger;

/**
 * Teltonika devices that publish to an MQTT broker instead of opening TCP (parameter 2006 = MQTT,
 * client type "AWS IoT Custom"): data on {@code <IMEI>/data}, commands on {@code <IMEI>/commands} as
 * {@code {"CMD":"<command>"}}, answers back on the data topic.
 * https://wiki.teltonika-gps.com/view/Codec_JSON
 *
 * <p>The broker authenticates the devices (TLS with a client certificate per device, its identity
 * the IMEI, and an ACL so each device only writes its own topics). This receiver is one more client:
 * it subscribes with QoS 1 and a persistent session, and acknowledges a message (PUBACK) only after
 * its records are published or durably kept, like the TCP receiver. A message that could not be
 * handled is not acknowledged and the client reconnects, so the broker delivers it again.
 *
 * <p>Payload: Codec JSON (one record) or the AVL data of Codec 8/8E (with or without the TCP
 * framing). The device is identified by the IMEI in the topic.
 */
public final class MqttReceiver {

    private static final Logger LOG = Logger.getLogger(MqttReceiver.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern IMEI_IN_TOPIC = Pattern.compile("(?:^|/)([0-9]{15})(?:/|$)");

    /** Broker connection and topics. */
    public record Settings(String host, int port, boolean tls, String caPath, String certPath, String keyPath,
            String clientId, String username, String password, String dataTopicFilter, String commandTopic,
            Duration reconnectDelay, Duration linkIdle) {
    }

    private final Receiver rx;
    private final Settings settings;
    private final SampledLog sampled = new SampledLog(LOG, 5, Duration.ofMinutes(1));
    private final PacketIngest ingest;
    private final Map<String, Link> links = new ConcurrentHashMap<>();
    private Context context;
    private MqttClient client;
    private volatile boolean stopped;

    public MqttReceiver(Receiver rx, Settings settings) {
        this.rx = rx;
        this.settings = settings;
        this.ingest = new PacketIngest(rx, sampled);
    }

    /** Connects and subscribes; completes when subscribed. A broker that is down is retried. */
    public Future<Void> start() {
        context = rx.vertx().getOrCreateContext();
        Promise<Void> started = Promise.promise();
        context.runOnContext(v -> connect(started));
        return started.future();
    }

    public Future<Void> stop() {
        stopped = true;
        links.values().forEach(Link::close);
        return client == null || !client.isConnected() ? Future.succeededFuture() : client.disconnect();
    }

    public boolean connected() {
        return client != null && client.isConnected();
    }

    private void connect(Promise<Void> started) {
        var options = new MqttClientOptions()
                .setClientId(clientId(settings.clientId()))
                .setCleanSession(false)
                .setAutoKeepAlive(true)
                .setMaxInflightQueue(1000);
        options.setAutoAck(false);
        if (settings.username() != null) {
            options.setUsername(settings.username()).setPassword(settings.password());
        }
        if (settings.tls()) {
            // The broker's certificate must name the host we connect to.
            options.setSsl(true).setHostnameVerificationAlgorithm("HTTPS");
            if (settings.caPath() != null) {
                options.setTrustOptions(new PemTrustOptions().addCertPath(settings.caPath()));
            }
            if (settings.certPath() != null && settings.keyPath() != null) {
                options.setKeyCertOptions(new PemKeyCertOptions().setCertPath(settings.certPath())
                        .setKeyPath(settings.keyPath()));
            }
        }
        client = MqttClient.create(rx.vertx(), options);
        client.publishHandler(this::onMessage);
        client.closeHandler(v -> {
            if (!stopped) {
                LOG.warnf("MQTT connection to %s:%d closed; reconnecting", settings.host(), settings.port());
                retry(null);
            }
        });
        client.connect(settings.port(), settings.host())
                .compose(ack -> client.subscribe(settings.dataTopicFilter(), MqttQoS.AT_LEAST_ONCE.value()))
                .onSuccess(id -> {
                    LOG.infof("MQTT receiver subscribed to %s on %s:%d", settings.dataTopicFilter(), settings.host(),
                            settings.port());
                    if (started != null) {
                        started.tryComplete();
                    }
                })
                .onFailure(e -> {
                    LOG.warnf("MQTT broker %s:%d not reachable (%s); retrying in %s", settings.host(),
                            settings.port(), e.getMessage(), settings.reconnectDelay());
                    retry(started);
                });
    }

    /** The configured client id with {@code {host}} replaced by this replica's host name. */
    public static String clientId(String configured) {
        if (!configured.contains("{host}")) {
            return configured;
        }
        String host = System.getenv("HOSTNAME");
        if (host == null || host.isBlank()) {
            try {
                host = java.net.InetAddress.getLocalHost().getHostName();
            } catch (java.io.IOException e) {
                host = UUID.randomUUID().toString().substring(0, 8);
            }
        }
        return configured.replace("{host}", host);
    }

    private void retry(Promise<Void> started) {
        if (stopped) {
            return;
        }
        if (started != null) {
            // The component does not wait for the broker: it keeps retrying in the background.
            started.tryComplete();
        }
        rx.vertx().setTimer(settings.reconnectDelay().toMillis(), t -> {
            if (!stopped && (client == null || !client.isConnected())) {
                connect(null);
            }
        });
    }

    private void onMessage(MqttPublishMessage message) {
        // The client this message arrived on: a failure must not close a newer connection.
        MqttClient from = client;
        try {
            handle(message, from);
        } catch (RuntimeException e) {
            // Never leave a message without PUBACK: the broker would stop delivering to this receiver.
            LOG.errorf(e, "MQTT message could not be handled, dropped: topic=%s", message.topicName());
            ack(message);
        }
    }

    private void handle(MqttPublishMessage message, MqttClient from) {
        String topic = message.topicName();
        byte[] payload = message.payload().getBytes();
        Matcher m = IMEI_IN_TOPIC.matcher(topic);
        if (!m.find()) {
            sampled.warn("topic:" + topic, "MQTT message without an IMEI in the topic, dropped: " + topic);
            ack(message);
            return;
        }
        String imei = m.group(1);
        Optional<RegisteredDevice> found = rx.registry().find(imei);
        if (found.isEmpty()) {
            rx.metrics().deviceRejected();
            sampled.warn("rejected:" + imei, "MQTT message of unregistered or inactive device, dropped: imei=" + imei);
            ack(message);
            return;
        }
        RegisteredDevice device = found.get();
        String remote = "mqtt:" + topic;
        link(imei).seen();
        String answer = commandAnswer(payload);
        if (answer != null) {
            rx.monitor().keep(PacketIngest.entry(device, java.time.Instant.now(), remote,
                    PacketLogEntry.COMMAND_RESPONSE, null, Codec12.CODEC_ID, 1, payload, PacketLogEntry.TELTONIKA_MQTT));
            link(imei).answered(answer);
            ack(message);
            return;
        }
        byte[] data = CodecJson.looksLikeJson(payload) ? null : avlData(payload);
        int declared = data == null ? 1 : (data.length > 1 ? data[1] & 0xFF : 0);
        ingest.handle(context, device, payload, PacketLogEntry.TELTONIKA_MQTT, remote, () -> decode(payload), declared)
                .onSuccess(count -> ack(message))
                .onFailure(e -> {
                    // Only the connection the message came on, and only once: later failures of the
                    // same connection find it closed, and a newer connection is left alone.
                    if (from == client && from.isConnected()) {
                        LOG.errorf(e, "MQTT message not acknowledged; reconnecting so the broker sends it again:"
                                + " imei=%s", imei);
                        from.disconnect();
                    }
                });
    }

    private void ack(MqttPublishMessage message) {
        if (message.qosLevel() != MqttQoS.AT_MOST_ONCE) {
            message.ack();
        }
    }

    /** Codec JSON, or Codec 8/8E with or without the TCP framing. */
    public static AvlPacket decode(byte[] payload) {
        if (CodecJson.looksLikeJson(payload)) {
            return CodecJson.parse(payload);
        }
        return CodecParser.parse(avlData(payload));
    }

    /**
     * Strips the TCP framing (4 zero bytes, length, CRC) when present and consistent: the declared
     * length must match the payload. Anything else goes to the parser as is, which rejects it.
     */
    public static byte[] avlData(byte[] payload) {
        if (payload.length > 12 && payload[0] == 0 && payload[1] == 0 && payload[2] == 0 && payload[3] == 0) {
            long length = ((payload[4] & 0xFFL) << 24) | ((payload[5] & 0xFFL) << 16) | ((payload[6] & 0xFFL) << 8)
                    | (payload[7] & 0xFFL);
            if (length > 0 && 8 + length + 4 == payload.length) {
                return Arrays.copyOfRange(payload, 8, payload.length - 4);
            }
        }
        return payload;
    }

    /**
     * The device's answer to a command, published on the data topic: JSON that is not a record
     * ({@code {"RSP": "..."}} and similar), or a Codec 12 response. Null for data.
     */
    public static String commandAnswer(byte[] payload) {
        if (CodecJson.looksLikeJson(payload)) {
            try {
                JsonNode n = JSON.readTree(payload);
                if (n.has("state") || n.has("reported")) {
                    return null;
                }
                for (String key : new String[] {"RSP", "rsp", "response", "RESP"}) {
                    if (n.hasNonNull(key)) {
                        return n.get(key).asText();
                    }
                }
                return n.toString();
            } catch (java.io.IOException e) {
                return null;
            }
        }
        byte[] data = avlData(payload);
        if (Codec12.isCodec12(data)) {
            try {
                return Codec12.decodeResponse(data);
            } catch (ProtocolException e) {
                return null;
            }
        }
        return null;
    }

    private Link link(String imei) {
        return links.computeIfAbsent(imei, Link::new);
    }

    /**
     * A device heard on the broker recently: the dispatcher sends it commands through its commands
     * topic. One command at a time; the answer arrives on the data topic.
     */
    private final class Link implements CommandLink {

        private final String imei;
        private volatile long lastSeen;
        private UUID pending;
        private long timer = -1;

        Link(String imei) {
            this.imei = imei;
        }

        void seen() {
            lastSeen = System.currentTimeMillis();
            rx.sessions().register(imei, this);
        }

        @Override
        public Future<Boolean> offerCommand(UUID id, String command) {
            Promise<Boolean> sent = Promise.promise();
            context.runOnContext(v -> {
                boolean idle = System.currentTimeMillis() - lastSeen > settings.linkIdle().toMillis();
                if (idle) {
                    close();
                }
                if (idle || pending != null || client == null || !client.isConnected()) {
                    sent.complete(false);
                    return;
                }
                pending = id;
                timer = rx.vertx().setTimer(rx.settings().commandTimeout().toMillis(), t -> timedOut(id));
                String topic = settings.commandTopic().replace("%imei%", imei).replace("{imei}", imei);
                String body = JSON.createObjectNode().put("CMD", command).toString();
                client.publish(topic, Buffer.buffer(body), MqttQoS.AT_LEAST_ONCE, false, false);
                rx.metrics().commandSent();
                LOG.infof("Command sent over MQTT: imei=%s, id=%s, command=%s", imei, id, command);
                sent.complete(true);
            });
            return sent.future();
        }

        void answered(String text) {
            context.runOnContext(v -> {
                UUID id = pending;
                pending = null;
                if (id == null) {
                    LOG.infof("Unrequested MQTT command response: imei=%s, response=%s", imei, text);
                    return;
                }
                rx.vertx().cancelTimer(timer);
                rx.metrics().commandAnswered();
                rx.commands().answered(id, text);
            });
        }

        private void timedOut(UUID id) {
            if (id.equals(pending)) {
                pending = null;
                rx.commands().failed(id, "no response within " + rx.settings().commandTimeout().toSeconds() + " s");
            }
        }

        @Override
        public String remoteAddress() {
            return "mqtt:" + imei;
        }

        @Override
        public void close() {
            rx.sessions().unregister(imei, this);
        }
    }
}
