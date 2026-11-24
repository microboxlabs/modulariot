package com.microboxlabs.miot.teltonika.server;

import com.microboxlabs.miot.teltonika.device.DeviceRegistry;
import com.microboxlabs.miot.teltonika.ingest.RecordSink;
import com.microboxlabs.miot.teltonika.monitor.DeviceMonitor;
import io.vertx.core.Vertx;
import java.time.Duration;
import java.util.UUID;

/**
 * What every session shares: settings, the device registry, where records go, monitoring and the
 * command callbacks.
 */
public record Receiver(
        Vertx vertx,
        Settings settings,
        DeviceRegistry registry,
        RecordSink sink,
        DeviceMonitor monitor,
        TeltonikaMetrics metrics,
        SessionRegistry sessions,
        PublishGate gate,
        CommandCallbacks commands) {

    /** Receiver settings. */
    public record Settings(
            String host,
            int port,
            Duration idleTimeout,
            Duration handshakeTimeout,
            int maxConnectionsPerIp,
            int acceptBacklog,
            int instances,
            Duration publishTimeout,
            Duration commandTimeout,
            boolean logRawPackets,
            Tls tls) {
    }

    /** TLS for the listener; disabled when {@code certPath} is blank. */
    public record Tls(String certPath, String keyPath) {

        public boolean enabled() {
            return certPath != null && !certPath.isBlank();
        }

        public static Tls none() {
            return new Tls(null, null);
        }
    }

    /** What happens to a command after the session sent it. */
    public interface CommandCallbacks {

        void answered(UUID commandId, String response);

        void failed(UUID commandId, String reason);

        static CommandCallbacks none() {
            return new CommandCallbacks() {
                @Override
                public void answered(UUID commandId, String response) {
                }

                @Override
                public void failed(UUID commandId, String reason) {
                }
            };
        }
    }
}
