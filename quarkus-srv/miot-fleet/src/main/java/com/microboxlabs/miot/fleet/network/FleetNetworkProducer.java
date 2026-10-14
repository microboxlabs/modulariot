package com.microboxlabs.miot.fleet.network;

import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Picks the network source from {@code miot.fleet.network.source}: {@code demo}, else none (503). */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetNetworkProducer {

    @ConfigProperty(name = "miot.fleet.network.source", defaultValue = "none")
    String source;

    @ConfigProperty(name = "miot.fleet.network.ttl.signal", defaultValue = "P30D")
    Duration signalTtl;

    @ConfigProperty(name = "miot.fleet.network.ttl.trip", defaultValue = "P7D")
    Duration tripTtl;

    @ConfigProperty(name = "miot.fleet.network.ttl.accreditation", defaultValue = "P30D")
    Duration accreditationTtl;

    /** Singleton: the service has no no-args constructor, so it cannot sit behind a client proxy. */
    @Produces
    @Singleton
    FleetNetworkService service() {
        Clock clock = Clock.systemUTC();
        NetworkSource network = switch (source) {
            case "demo" -> new DemoNetworkSource(clock::instant);
            default -> viewer -> {
                throw new NetworkUnavailableException("Fleet network data is not configured");
            };
        };
        NetworkPolicy policy = new NetworkPolicy(Map.of(
                EvidenceSource.SIGNAL, signalTtl,
                EvidenceSource.TRIP, tripTtl,
                EvidenceSource.ACCREDITATION, accreditationTtl));
        return new FleetNetworkService(network, policy, clock);
    }
}
