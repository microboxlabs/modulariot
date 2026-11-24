package com.microboxlabs.miot.teltonika.server;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

/**
 * Receiver meters, exposed at {@code /q/metrics} with the {@code miot_teltonika_} prefix.
 */
public final class TeltonikaMetrics {

    private final AtomicInteger connected = new AtomicInteger();
    private final MeterRegistry registry;
    private final Counter accepted;
    private final Counter rejected;
    private final Counter handshakeTimeouts;
    private final Counter ipLimited;
    private final Counter sessionsReplaced;
    private final Counter packets;
    private final Counter crcErrors;
    private final Counter protocolErrors;
    private final Counter quarantined;
    private final Counter records;
    private final Counter recordsNotPublished;
    private final Counter duplicates;
    private final Counter publishFailures;
    private final Counter commandsSent;
    private final Counter commandsAnswered;
    private final Timer publishLatency;
    private final Timer recordLag;

    public TeltonikaMetrics(MeterRegistry registry) {
        this.registry = registry;
        registry.gauge("miot.teltonika.connections.active", connected);
        accepted = registry.counter("miot.teltonika.devices.accepted");
        rejected = registry.counter("miot.teltonika.devices.rejected");
        handshakeTimeouts = registry.counter("miot.teltonika.handshake.timeouts");
        ipLimited = registry.counter("miot.teltonika.connections.ip_limited");
        sessionsReplaced = registry.counter("miot.teltonika.sessions.replaced");
        packets = registry.counter("miot.teltonika.packets");
        crcErrors = registry.counter("miot.teltonika.packets.crc_errors");
        protocolErrors = registry.counter("miot.teltonika.protocol_errors");
        quarantined = registry.counter("miot.teltonika.packets.quarantined");
        records = registry.counter("miot.teltonika.records.published");
        recordsNotPublished = registry.counter("miot.teltonika.records.not_published");
        duplicates = registry.counter("miot.teltonika.records.duplicates");
        publishFailures = registry.counter("miot.teltonika.publish.failures");
        commandsSent = registry.counter("miot.teltonika.commands.sent");
        commandsAnswered = registry.counter("miot.teltonika.commands.answered");
        publishLatency = Timer.builder("miot.teltonika.publish.latency").publishPercentiles(0.5, 0.95, 0.99)
                .register(registry);
        recordLag = Timer.builder("miot.teltonika.records.lag")
                .description("Reception time minus record time").publishPercentiles(0.5, 0.95)
                .register(registry);
    }

    public void gauge(String name, Supplier<Number> value) {
        registry.gauge(name, value, v -> v.get().doubleValue());
    }

    void connectionOpened() {
        connected.incrementAndGet();
    }

    void connectionClosed() {
        connected.decrementAndGet();
    }

    void deviceAccepted() {
        accepted.increment();
    }

    void deviceRejected() {
        rejected.increment();
    }

    void handshakeTimeout() {
        handshakeTimeouts.increment();
    }

    void ipLimited() {
        ipLimited.increment();
    }

    void sessionReplaced() {
        sessionsReplaced.increment();
    }

    void packetReceived() {
        packets.increment();
    }

    void crcError() {
        crcErrors.increment();
    }

    void protocolError() {
        protocolErrors.increment();
    }

    void quarantined() {
        quarantined.increment();
    }

    void published(int published, int notPublished, int dup) {
        records.increment(published);
        recordsNotPublished.increment(notPublished);
        duplicates.increment(dup);
    }

    void publishFailed() {
        publishFailures.increment();
    }

    void publishTook(Duration d) {
        publishLatency.record(d);
    }

    void recordLag(Duration d) {
        if (!d.isNegative()) {
            recordLag.record(d);
        }
    }

    void commandSent() {
        commandsSent.increment();
    }

    void commandAnswered() {
        commandsAnswered.increment();
    }

    public int activeConnections() {
        return connected.get();
    }
}
