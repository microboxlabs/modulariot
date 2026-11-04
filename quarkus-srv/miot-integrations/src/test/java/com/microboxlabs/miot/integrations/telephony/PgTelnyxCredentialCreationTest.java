package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ManagedConnectionLock;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import jakarta.enterprise.inject.Instance;
import java.net.URI;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Two independent token issuers contend through native PostgreSQL, with a fake provider. */
@EnabledIfSystemProperty(named = "miot.integrations.test.pg-url", matches = ".+")
class PgTelnyxCredentialCreationTest {
    @Test
    @SuppressWarnings("unchecked")
    void createsOnlyOneFirstUseCredentialAcrossInstances() throws Exception {
        Vertx vertx = Vertx.vertx();
        Pool pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.pg-url")))
                .with(new PoolOptions().setMaxSize(3)).using(vertx).build();
        Instance<Pool> pools = (Instance<Pool>) java.lang.reflect.Proxy.newProxyInstance(
                Instance.class.getClassLoader(), new Class<?>[]{Instance.class}, (proxy, method, args) -> {
                    if ("get".equals(method.getName())) return pool;
                    throw new UnsupportedOperationException(method.getName());
                });
        CountDownLatch firstListing = new CountDownLatch(1);
        CountDownLatch releaseListing = new CountDownLatch(1);
        AtomicInteger listings = new AtomicInteger();
        AtomicInteger creations = new AtomicInteger();
        AtomicBoolean created = new AtomicBoolean();
        String name = TelnyxWebRtcTokens.credentialName("acme", "ana@example.com");
        TelephonyHttp provider = request -> {
            String path = request.uri().getRawPath();
            if (path.startsWith("/v2/credential_connections/")) {
                return new StubHttp().reply("GET " + path, 200, TelnyxWebRtcTokensTest.parked("conn-1")).send(request);
            }
            String body;
            if ("GET".equals(request.method())) {
                if (listings.incrementAndGet() == 1) {
                    firstListing.countDown();
                    assertTrue(releaseListing.await(5, TimeUnit.SECONDS));
                }
                body = created.get() ? "{\"data\":[{\"id\":\"login-1\",\"name\":\"" + name
                        + "\",\"resource_id\":\"connection:sip-1\",\"expired\":false}]}" : "{\"data\":[]}";
            } else if (path.endsWith("/token")) {
                body = "synthetic-token";
            } else {
                creations.incrementAndGet();
                created.set(true);
                body = "{\"data\":{\"id\":\"login-1\"}}";
            }
            return new StubHttp().reply(request.method() + " " + path, 200, body).send(request);
        };
        TelnyxWebRtcTokens first = issuer(new ManagedConnectionLock(pools), provider);
        TelnyxWebRtcTokens second = issuer(new ManagedConnectionLock(pools), provider);
        CountDownLatch secondStarted = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            var one = workers.submit(() -> first.issue("acme", "conn-1", "ana@example.com"));
            try {
                assertTrue(firstListing.await(5, TimeUnit.SECONDS));
                var two = workers.submit(() -> {
                    secondStarted.countDown();
                    return second.issue("acme", "conn-1", "ANA@example.com");
                });
                assertTrue(secondStarted.await(5, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> two.get(150, TimeUnit.MILLISECONDS));
                assertEquals(1, listings.get(), "the second issuer cannot list while the first holds the credential provisioning lock");
                releaseListing.countDown();
                assertEquals("synthetic-token", one.get(5, TimeUnit.SECONDS).token());
                assertEquals("synthetic-token", two.get(5, TimeUnit.SECONDS).token());
                assertEquals(2, listings.get());
                assertEquals(1, creations.get());
            } finally {
                releaseListing.countDown();
            }
        } finally {
            pool.closeAndAwait();
            vertx.closeAndAwait();
        }
    }

    private static TelnyxWebRtcTokens issuer(ManagedConnectionLock lock, TelephonyHttp provider) {
        URI api = URI.create("https://api.telnyx.test");
        var connection = new IntegrationConnection("conn-1", "acme", "Line", ProviderType.TELNYX, api, "cred",
                ConnectionStatus.ACTIVE, null, null, Map.of("sipConnectionId", "sip-1", "callerNumber", "+56900000000"));
        return new TelnyxWebRtcTokens((tenant, id) -> connection,
                (tenant, c) -> new ResolvedConnection(c.id(), c.baseUrl(), c.metadata(), Map.of("token", "KEY_test")),
                new TelnyxClient(provider, api), new ObjectMapper(), Clock.systemUTC(), "https://miot.test", lock::locked);
    }
}
