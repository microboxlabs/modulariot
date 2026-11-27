package com.microboxlabs.miot.teltonika.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/**
 * Settings of the Teltonika receiver ({@code miot.teltonika.*}). Defaults are production values;
 * the dev profile in miot-cli adds bootstrap devices.
 */
@ConfigMapping(prefix = "miot.teltonika")
public interface TeltonikaConfig {

    /** Interface the TCP listener binds to. */
    @WithDefault("0.0.0.0")
    String host();

    /** TCP port the devices connect to (device parameter 2005). */
    @WithDefault("5027")
    int port();

    /** Host name installers load into the devices (parameter 2004), shown in the connection guide. */
    @WithDefault("devices.modulariot.com")
    String publicHost();

    /** Port shown in the connection guide; the port behind the load balancer may differ. */
    @WithDefault("5027")
    int publicPort();

    /** Connections without traffic for this long are closed; longer than the device's open link timeout (300 s). */
    @WithDefault("600s")
    Duration idleTimeout();

    /** A connection that does not send its IMEI within this time is closed. */
    @WithDefault("10s")
    Duration handshakeTimeout();

    /** Connections accepted per source address (an APN NAT may put several devices behind one address). */
    @WithDefault("50")
    int maxConnectionsPerIp();

    /**
     * Pending connections the operating system queues for the listener. After a network outage
     * thousands of devices reconnect at once; a short queue makes some fail and retry later.
     */
    @WithDefault("8192")
    int acceptBacklog();

    /** Listener instances, each on its own event loop; 0 means one per available processor. */
    @WithDefault("0")
    int instances();

    /**
     * Outside development the receiver refuses to start without a real broker: with the log
     * publisher (standalone mode) every packet would be acknowledged and lost.
     */
    @WithDefault("true")
    boolean requireBroker();

    /** A registered device must prove possession (activation code in parameter 2015) before publishing. */
    @WithDefault("true")
    boolean activationRequired();

    /** A pending claim not proved within this time can be taken by another organization. */
    @WithDefault("72h")
    Duration claimTtl();

    /** The first assignment starts this long before the registration, covering what the device buffered. */
    @WithDefault("7d")
    Duration assignmentBackfill();

    /** Pulsar topic for the positions; the same one {@code /v1/asset/track} publishes to. */
    String topic();

    /** Value of {@code telecom.gps_provider}. */
    @WithDefault("Teltonika")
    String gpsProvider();

    /** Keep the last known position of records without a current fix (FMB behaviour). */
    @WithDefault("true")
    boolean publishLastKnownPosition();

    /** A publish slower than this fails and the device resends; below the device's ack timeout (30 s). */
    @WithDefault("20s")
    Duration publishTimeout();

    /** Records being published at once across all sessions. */
    @WithDefault("2000")
    int maxInFlightRecords();

    /** Records further in the future than this are kept in the packet log, not published (clock wrong). */
    @WithDefault("5m")
    Duration maxFutureSkew();

    /** Records older than this are kept in the packet log, not published. */
    @WithDefault("30d")
    Duration maxRecordAge();

    /** Record times remembered per device to drop resent records. */
    @WithDefault("256")
    int duplicateWindow();

    /** Devices not heard for this long leave the duplicate filter. */
    @WithDefault("2h")
    Duration duplicateIdleEviction();

    /** How often the receiver re-reads the device registry (changes made on other pods). */
    @WithDefault("10s")
    Duration registryRefresh();

    /** How often status and kept packets are written. */
    @WithDefault("5s")
    Duration monitorFlush();

    /** Kept packets waiting to be written; beyond this they are dropped and counted. */
    @WithDefault("10000")
    int packetQueueSize();

    /** Packet log retention. */
    @WithDefault("7d")
    Duration packetRetention();

    /** How often pending commands are delivered. */
    @WithDefault("2s")
    Duration commandPoll();

    /** A sent command without a response within this time fails. */
    @WithDefault("30s")
    Duration commandTimeout();

    /** Time allowed on shutdown to acknowledge the packets being published. */
    @WithDefault("15s")
    Duration shutdownGrace();

    /** Log every packet in hex at INFO. Packets are always logged at DEBUG. */
    @WithDefault("false")
    boolean logRawPackets();

    /** PEM certificate for TLS (device parameter 2020); TLS is off when unset. */
    Optional<String> tlsCertPath();

    /** PEM private key for TLS. */
    Optional<String> tlsKeyPath();

    /**
     * Devices registered at startup when missing, {@code "<imei>"=<tenant code>/<asset id>}.
     * For local environments and the emulator; production registers devices through the API.
     */
    Map<String, String> bootstrapDevices();

    /** UDP port for devices configured with protocol UDP (parameter 2006 = 1); UDP is off when unset. */
    Optional<Integer> udpPort();

    /**
     * Shared key Traccar sends in {@code x-miot-traccar-key} when forwarding positions to
     * {@code /internal/gps/traccar/positions}; the endpoint answers 503 when unset.
     */
    Optional<String> traccarKey();

    /** Address of the Traccar gateway shown in the guide of other brands; the public host when unset. */
    Optional<String> traccarPublicHost();

    /** Teltonika devices that publish to an MQTT broker. */
    Mqtt mqtt();

    /** Broker the MQTT devices publish to; this receiver subscribes as one more client. */
    interface Mqtt {

        @WithDefault("false")
        boolean enabled();

        @WithDefault("localhost")
        String host();

        @WithDefault("8883")
        int port();

        /** Teltonika devices only connect over TLS; the receiver uses TLS too unless turned off. */
        @WithDefault("true")
        boolean tls();

        /** CA that signed the broker certificate (PEM). */
        Optional<String> caPath();

        /** The receiver's own client certificate and key (PEM), when the broker requires them. */
        Optional<String> certPath();

        Optional<String> keyPath();

        /**
         * Client id, one per replica: {@code {host}} is replaced by the pod's host name, so replicas
         * do not take each other's session. With a persistent session the broker keeps the messages
         * while the replica is down; run the receiver as a StatefulSet so the name (and the session)
         * survives a restart.
         */
        @WithDefault("miot-teltonika-receiver-{host}")
        String clientId();

        Optional<String> username();

        Optional<String> password();

        /** Shared subscription so several receiver instances split the devices. */
        @WithDefault("$share/miot-teltonika/+/data")
        String dataTopicFilter();

        /** Where commands go; {@code %imei%} is replaced. */
        @WithDefault("%imei%/commands")
        String commandTopic();

        @WithDefault("10s")
        Duration reconnectDelay();

        /** A device not heard on the broker for this long gets no commands until it publishes again. */
        @WithDefault("15m")
        Duration linkIdle();
    }
}
