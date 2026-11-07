package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.inject.Instance;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SignalStreamMetricsTest {

    private record Roads(boolean enabled, int maxTiles, Duration ttl) implements SignalStream.RoadSettings {
    }

    @Test
    void aDisabledBuilderDoesNotReadOnlineSettingsOrRegisterOrRefreshVehicleGauges() {
        var meters = new SimpleMeterRegistry();
        try {
            SignalStream stream = new SignalStream(false, "UTC", new Roads(false, 1, Duration.ofHours(1)),
                    Optional::empty, null, null, null, unavailablePool(), null, meters);
            try {
                stream.onStart(null);
                stream.pruneOnline();
                stream.scheduledReload().await().indefinitely();
                assertTrue(meters.getMeters().stream()
                        .noneMatch(m -> m.getId().getName().startsWith("miot.symptoms.vehicles.")));
            } finally {
                stream.onStop(null);
            }
        } finally {
            meters.close();
        }
    }

    @SuppressWarnings("unchecked")
    private static Instance<Pool> unavailablePool() {
        return (Instance<Pool>) Proxy.newProxyInstance(SignalStreamMetricsTest.class.getClassLoader(),
                new Class<?>[] {Instance.class}, (proxy, method, args) -> {
                    throw new AssertionError("Disabled builder accessed its database");
                });
    }
}
