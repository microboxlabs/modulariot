package com.microboxlabs.miot.integrations.retransmit;

import com.microboxlabs.miot.integrations.retransmit.GaussPositionMapper.Defaults;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;
import java.util.Locale;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Groups retransmit delivery config so {@link RetransmitDeliveryJob} stays within
 * constructor-parameter limits (Sonar java:S107).
 */
@ApplicationScoped
public class RetransmitDeliverySettings {

    private final boolean workerEnabled;
    private final int claimLimit;
    private final int leaseSeconds;
    private final int retryBaseSeconds;
    private final int retryMaxSeconds;
    private final String payloadFormat;
    private final boolean logTraffic;
    private final Defaults gaussDefaults;

    RetransmitDeliverySettings(
            @ConfigProperty(name = "miot.integrations.retransmit.worker.enabled", defaultValue = "false")
                    boolean workerEnabled,
            @ConfigProperty(name = "miot.integrations.retransmit.claim-limit", defaultValue = "20")
                    int claimLimit,
            @ConfigProperty(name = "miot.integrations.retransmit.lease-seconds", defaultValue = "60")
                    int leaseSeconds,
            @ConfigProperty(name = "miot.integrations.retransmit.retry-base-seconds", defaultValue = "30")
                    int retryBaseSeconds,
            @ConfigProperty(name = "miot.integrations.retransmit.retry-max-seconds", defaultValue = "900")
                    int retryMaxSeconds,
            @ConfigProperty(name = "miot.integrations.retransmit.payload-format", defaultValue = "auto")
                    String payloadFormat,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.log-traffic", defaultValue = "false")
                    boolean logTraffic,
            Defaults gaussDefaults) {
        this.workerEnabled = workerEnabled;
        this.claimLimit = claimLimit;
        this.leaseSeconds = leaseSeconds;
        this.retryBaseSeconds = retryBaseSeconds;
        this.retryMaxSeconds = retryMaxSeconds;
        this.payloadFormat = payloadFormat == null ? "auto" : payloadFormat.trim().toLowerCase(Locale.ROOT);
        this.logTraffic = logTraffic;
        this.gaussDefaults = gaussDefaults;
    }

    // Singleton, not @ApplicationScoped: Defaults is a record (final), and a
    // normal scope would need a client proxy ArC cannot subclass it into.
    @Produces
    @Singleton
    static Defaults gaussDefaults(
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.tags", defaultValue = ";MEL;")
                    String gaussTags,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.device-type", defaultValue = "gps")
                    String gaussDeviceType,
            @ConfigProperty(
                            name = "miot.integrations.retransmit.gauss.event-provider",
                            defaultValue = "streamhub")
                    String gaussEventProvider,
            @ConfigProperty(
                            name = "miot.integrations.retransmit.gauss.device-model",
                            defaultValue = "streamhub-miot")
                    String gaussDeviceModel) {
        return Defaults.fromConfig(gaussTags, gaussDeviceType, gaussEventProvider, gaussDeviceModel);
    }

    boolean workerEnabled() {
        return workerEnabled;
    }

    int claimLimit() {
        return claimLimit;
    }

    int leaseSeconds() {
        return leaseSeconds;
    }

    int retryBaseSeconds() {
        return retryBaseSeconds;
    }

    int retryMaxSeconds() {
        return retryMaxSeconds;
    }

    String payloadFormat() {
        return payloadFormat;
    }

    /**
     * When true, log Gauss HTTP request payload and response body at INFO
     * (auth headers redacted). Off by default — enable only for traffic capture.
     */
    boolean logTraffic() {
        return logTraffic;
    }

    Defaults gaussDefaults() {
        return gaussDefaults;
    }
}
