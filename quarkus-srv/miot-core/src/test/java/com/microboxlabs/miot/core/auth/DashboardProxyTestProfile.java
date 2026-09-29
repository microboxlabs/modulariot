package com.microboxlabs.miot.core.auth;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import io.quarkus.test.junit.QuarkusTestProfile;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * {@code @QuarkusTest} profile for {@code DashboardProxyResource}: the same
 * auth chain {@link HarnessProxyTestProfile} sets up, with the
 * {@code "dashboards"} REST client pointed at its own WireMock instance.
 *
 * <p>A separate profile rather than a shared one, so a change to either
 * proxy's upstream stubbing cannot move the other proxy's tests.
 */
public class DashboardProxyTestProfile implements QuarkusTestProfile {

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

        // The "dashboards" REST client URL is injected by DashboardWireMock.start()
        // at runtime: the WireMock port is ephemeral, because a fixed one collides
        // with whatever else holds it on the host.

        // Force the stub Alfresco clients to win, as the harness profile does:
        // @LookupUnlessProperty gates programmatic lookups, not direct @Inject.
        overrides.put("miot.alfresco.auth", "stub");
        overrides.put("quarkus.arc.exclude-types",
                "com.microboxlabs.miot.core.alfresco.RealAlfrescoDirectoryClient,"
                        + "com.microboxlabs.miot.core.alfresco.RealAlfrescoGroupAdminClient,"
                        + "com.microboxlabs.miot.core.alfresco.RealAlfrescoMembershipClient");

        // miot-core has no application.properties on the test classpath, so
        // without these /api/* would be permit-all and the 401 would never fire.
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
        return List.of(new TestResourceEntry(DashboardWireMock.class));
    }

    /** Starts and stops the WireMock standing in for the dashboard server. */
    public static class DashboardWireMock implements QuarkusTestResourceLifecycleManager {

        private static volatile WireMockServer server;

        /** The shared instance; null before start and after stop. */
        public static WireMockServer server() {
            return server;
        }

        @Override
        public Map<String, String> start() {
            server = new WireMockServer(WireMockConfiguration.options().dynamicPort());
            server.start();
            return Map.of("quarkus.rest-client.\"dashboards\".url",
                    "http://localhost:" + server.port());
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
