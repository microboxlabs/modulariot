package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import jakarta.enterprise.inject.Instance;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Uses a dedicated, disposable native PostgreSQL database; never starts containers. */
@EnabledIfSystemProperty(named = "miot.integrations.test.telephony-pg-url", matches = ".+")
class PgTelephonyReadinessTest {
    private static Vertx vertx;
    private static Pool pool;
    private static IntegrationConnectionRepository repository;
    private static final String CREDENTIAL = UUID.randomUUID().toString();
    private static final Map<String, Object> METADATA = Map.of("sipConnectionId", "sip-1", "callerNumber", "+56900000000");

    @BeforeAll
    @SuppressWarnings("unchecked")
    static void setup() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.telephony-pg-url")))
                .with(new PoolOptions().setMaxSize(2)).using(vertx).build();
        pool.query("CREATE SCHEMA miot_integrations").execute().await().indefinitely();
        pool.query("""
                CREATE TABLE miot_integrations.integration_connections (
                    id UUID PRIMARY KEY, tenant_code TEXT NOT NULL, name TEXT NOT NULL,
                    provider_type TEXT NOT NULL, base_url TEXT NOT NULL, credential_profile_id UUID,
                    status TEXT NOT NULL, last_tested_at TIMESTAMPTZ, last_test_result BOOLEAN,
                    metadata JSONB, template_id UUID, active BOOLEAN NOT NULL DEFAULT true,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now())
                """).execute().await().indefinitely();
        Instance<Pool> pools = (Instance<Pool>) java.lang.reflect.Proxy.newProxyInstance(
                Instance.class.getClassLoader(), new Class<?>[]{Instance.class}, (proxy, method, args) -> {
                    if ("get".equals(method.getName())) return pool;
                    throw new UnsupportedOperationException(method.getName());
                });
        repository = new IntegrationConnectionRepository(pools);
    }

    @BeforeEach
    void clear() {
        pool.query("TRUNCATE miot_integrations.integration_connections").execute().await().indefinitely();
    }

    @AfterAll
    static void close() {
        if (pool != null) pool.closeAndAwait();
        if (vertx != null) vertx.closeAndAwait();
    }

    @Test
    void changingAnyTelephonyInputRequiresANewTestButRenamingAndUnchangedInputsKeepReadiness() {
        var line = create("acme", ProviderType.TELNYX, CREDENTIAL, ConnectionStatus.ACTIVE);
        var same = repository.update("acme", line.id(), "Renamed", line.baseUrl().toString(), CREDENTIAL, METADATA);
        assertEquals(ConnectionStatus.ACTIVE, same.status());
        assertTrue(same.lastTestResult());
        assertEquals(line.lastTestedAt(), same.lastTestedAt());

        assertNeedsTest(repository.update("acme", line.id(), null, null, null,
                Map.of("sipConnectionId", "sip-new", "callerNumber", "+56900000000")));
        ready(line);
        assertNeedsTest(repository.update("acme", line.id(), null, null, UUID.randomUUID().toString(), null));
        ready(line);
        assertNeedsTest(repository.update("acme", line.id(), null, "https://changed.example", null, null));
    }

    @Test
    void invalidationIsScopedToTheCredentialTenantAndPhoneProviders() {
        var telnyx = create("acme", ProviderType.TELNYX, CREDENTIAL, ConnectionStatus.ACTIVE);
        var teams = create("acme", ProviderType.TEAMS_PHONE, CREDENTIAL, ConnectionStatus.ACTIVE);
        var disabled = create("acme", ProviderType.TELNYX, CREDENTIAL, ConnectionStatus.INACTIVE);
        var otherTenant = create("other", ProviderType.TELNYX, CREDENTIAL, ConnectionStatus.ACTIVE);
        var otherCredential = create("acme", ProviderType.TELNYX, UUID.randomUUID().toString(), ConnectionStatus.ACTIVE);
        var whatsapp = create("acme", ProviderType.WHATSAPP, CREDENTIAL, ConnectionStatus.ACTIVE);
        assertEquals(3, repository.invalidateTelephonyCredential("acme", CREDENTIAL));
        assertNeedsTest(read(telnyx));
        assertNeedsTest(read(teams));
        assertEquals(ConnectionStatus.INACTIVE, read(disabled).status());
        assertNull(read(disabled).lastTestResult());
        assertEquals(ConnectionStatus.ACTIVE, read(otherTenant).status());
        assertEquals(ConnectionStatus.ACTIVE, read(otherCredential).status());
        assertEquals(ConnectionStatus.ACTIVE, read(whatsapp).status());
    }

    @Test
    void editingOtherProvidersKeepsTheirExistingTestAndNeverReactivatesDisabledPhoneLines() {
        var whatsapp = create("acme", ProviderType.WHATSAPP, CREDENTIAL, ConnectionStatus.ACTIVE);
        var updated = repository.update("acme", whatsapp.id(), null, null, null, Map.of("phone_number_id", "new"));
        assertEquals(ConnectionStatus.ACTIVE, updated.status());
        assertTrue(updated.lastTestResult());
        var disabled = create("acme", ProviderType.TELNYX, CREDENTIAL, ConnectionStatus.INACTIVE);
        updated = repository.update("acme", disabled.id(), null, null, null, Map.of("sipConnectionId", "new"));
        assertEquals(ConnectionStatus.INACTIVE, updated.status());
        assertNull(updated.lastTestResult());
    }

    private static IntegrationConnection create(String tenant, ProviderType provider, String credential, ConnectionStatus status) {
        return repository.create(new IntegrationConnection(UUID.randomUUID().toString(), tenant, "Phone", provider,
                URI.create("https://example.test"), credential, status, OffsetDateTime.now().withNano(0), true, METADATA));
    }

    private static IntegrationConnection read(IntegrationConnection line) {
        return repository.findByTenantAndId(line.tenantCode(), line.id());
    }

    private static void ready(IntegrationConnection line) {
        repository.updateTestResult(line.tenantCode(), line.id(), ConnectionStatus.ACTIVE, OffsetDateTime.now(), true);
    }

    private static void assertNeedsTest(IntegrationConnection line) {
        assertEquals(ConnectionStatus.DRAFT, line.status());
        assertNull(line.lastTestedAt());
        assertNull(line.lastTestResult());
    }
}
