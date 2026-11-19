package com.microboxlabs.miot.core.health;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.smallrye.config.SmallRyeConfigBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.inject.Instance;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.eclipse.microprofile.health.HealthCheckResponse.Status;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PoolLivenessConfigurationTest {

    @Test
    void gatewayOnlyDoesNotResolveTheDatabasePool() {
        var config = new SmallRyeConfigBuilder().withDefaultValue("miot.component.gateway.enabled", "true").build();
        AtomicInteger resolutions = new AtomicInteger();
        var check = new PoolLiveness(pool(resolutions), config, Duration.ZERO, 1);

        check.probe();

        assertEquals(0, resolutions.get());
        assertEquals(Status.UP, check.call().getStatus());
    }

    @Test
    void inactiveDatasourceDoesNotResolveTheDatabasePool() {
        var config = new SmallRyeConfigBuilder().withDefaultValue("miot.component.fleet.enabled", "true")
                .withDefaultValue("quarkus.datasource.active", "false").build();
        AtomicInteger resolutions = new AtomicInteger();
        var check = new PoolLiveness(pool(resolutions), config, Duration.ZERO, 1);

        check.probe();

        assertEquals(0, resolutions.get());
        assertEquals(Status.UP, check.call().getStatus());
    }

    @ParameterizedTest
    @ValueSource(strings = {"fleet", "tracking", "integrations", "conversational", "symptoms", "trips", "places"})
    void databaseComponentsResolveThePool(String component) {
        var config = new SmallRyeConfigBuilder()
                .withDefaultValue("miot.component." + component + ".enabled", "true").build();
        AtomicInteger resolutions = new AtomicInteger();
        var check = new PoolLiveness(pool(resolutions), config, Duration.ZERO, 1);

        check.probe();

        assertEquals(1, resolutions.get());
    }

    @SuppressWarnings("unchecked")
    private static Instance<Pool> pool(AtomicInteger resolutions) {
        return (Instance<Pool>) Proxy.newProxyInstance(PoolLivenessConfigurationTest.class.getClassLoader(),
                new Class<?>[]{Instance.class}, (proxy, method, args) -> {
                    if (method.getName().equals("isResolvable")) {
                        resolutions.incrementAndGet();
                        return false;
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
    }
}
