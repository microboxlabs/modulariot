package com.microboxlabs.miot.core.auth;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import io.quarkus.test.junit.QuarkusTestProfile;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Shared {@code @QuarkusTest} profile that wires the auth chain to
 * {@link MockOidcResource} and the {@code "harness"} REST client to a
 * test-scoped WireMock instance.
 *
 * <p>Config overrides:
 * <ul>
 *   <li>{@code miot.auth.*} → values matching {@link TestTokenFactory}'s tokens</li>
 *   <li>{@code miot.auth.jwks-url} → MockOidcResource on the same Quarkus test port</li>
 *   <li>{@code quarkus.rest-client."harness".url} → port {@link WireMockLifecycle} listens on</li>
 *   <li>{@code quarkus.http.auth.permission.*} → mirrors prod (authenticated /api/*)</li>
 *   <li>Datasource: relies on Quarkus DevServices Postgres + Flyway core migrations</li>
 * </ul>
 *
 * <p>The WireMock server lifecycle is owned by the inner
 * {@link WireMockLifecycle} so all five Q0 files stay under
 * {@code src/test/java/.../auth/}.
 */
public class HarnessProxyTestProfile implements QuarkusTestProfile {

    /** Fixed port for the test WireMock instance. */
    public static final int WIREMOCK_PORT = 18089;

    @Override
    public Map<String, String> getConfigOverrides() {
        Map<String, String> overrides = new HashMap<>();

        // Auth: DualJwtAuthMechanism reaches MockOidcResource on the same test JVM.
        overrides.put("miot.auth.rs256-issuer", TestTokenFactory.ISSUER);
        overrides.put("miot.auth.rs256-audience", TestTokenFactory.WEB_AUDIENCE);
        overrides.put("miot.auth.jwks-url",
                "http://localhost:${quarkus.http.test-port:8081}/_test/oidc/jwks");
        overrides.put("miot.auth.hs256-issuer", TestTokenFactory.ISSUER);
        overrides.put("miot.auth.hs256-secret", TestTokenFactory.HS256_SECRET);
        overrides.put("miot.auth.hs256-audience", TestTokenFactory.M2M_AUDIENCE);

        // Harness REST client binding (used from Q1 onward; declared in Q0 so the
        // binding name + URL placeholder are stable across rungs).
        overrides.put("quarkus.rest-client.\"harness\".url",
                "http://localhost:" + WIREMOCK_PORT);

        // Force the @DefaultBean stub Alfresco directory/group-admin clients to win.
        // @LookupUnlessProperty(stringValue="stub") only gates programmatic lookups,
        // not direct @Inject, so the real REST-client-backed beans would otherwise
        // win and trip an unconfigured-baseUri 500 on the happy path.
        overrides.put("miot.alfresco.auth", "stub");
        overrides.put("quarkus.arc.exclude-types",
                "com.microboxlabs.miot.core.alfresco.RealAlfrescoDirectoryClient,"
                        + "com.microboxlabs.miot.core.alfresco.RealAlfrescoGroupAdminClient");

        // Permission policy: miot-core has no application.properties; without
        // these /api/* would be permit-all and the 401/403 split would not fire.
        overrides.put("quarkus.http.auth.permission.api.paths", "/api/*");
        overrides.put("quarkus.http.auth.permission.api.policy", "authenticated");
        overrides.put("quarkus.http.auth.permission.public.paths", "/_test/*,/q/*");
        overrides.put("quarkus.http.auth.permission.public.policy", "permit");

        // DB: DevServices Postgres + Flyway runs the miot_core migrations on start.
        overrides.put("quarkus.datasource.db-kind", "postgresql");
        overrides.put("quarkus.flyway.migrate-at-start", "true");
        overrides.put("quarkus.flyway.locations", "db/migration/core");
        overrides.put("quarkus.flyway.schemas", "miot_core");
        overrides.put("quarkus.flyway.create-schemas", "true");
        overrides.put("quarkus.hibernate-orm.schema-management.strategy", "none");
        overrides.put("quarkus.hibernate-orm.physical-naming-strategy",
                "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy");

        return overrides;
    }

    @Override
    public List<TestResourceEntry> testResources() {
        return List.of(new TestResourceEntry(WireMockLifecycle.class));
    }

    /**
     * Starts/stops a {@link WireMockServer} on {@link #WIREMOCK_PORT}. The
     * server is exposed via {@link #server()} so later rungs (Q1..Q3) can
     * stub harness routes without owning the lifecycle.
     */
    public static class WireMockLifecycle implements QuarkusTestResourceLifecycleManager {

        private static volatile WireMockServer server;

        /** Returns the shared WireMock instance (null before start/after stop). */
        public static WireMockServer server() {
            return server;
        }

        @Override
        public Map<String, String> start() {
            server = new WireMockServer(WireMockConfiguration.options().port(WIREMOCK_PORT));
            server.start();
            return Map.of();
        }

        @Override
        public void stop() {
            if (server != null) {
                server.stop();
                server = null;
            }
        }
    }
}
