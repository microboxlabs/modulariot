package com.microboxlabs.miot.cli;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.smallrye.config.SmallRyeConfig;
import io.smallrye.config.SmallRyeConfigBuilder;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.config.Config;
import org.junit.jupiter.api.Test;

/** Starts the modulith with the symptoms API, without a database, broker or Docker. */
@QuarkusTest
@TestProfile(DeviceEventsDisabledTest.Profile.class)
class DeviceEventsDisabledTest {

    @TestHTTPResource
    URI baseUri;

    @Inject
    Config config;

    @Test
    @TestSecurity(authorizationEnabled = false)
    void signalBuilderOffStartsAndDeviceEventsAnswer503() throws Exception {
        assertFalse(config.getValue("mp.messaging.outgoing.device-signals.enabled", Boolean.class));
        try (HttpClient client = HttpClient.newHttpClient()) {
            HttpRequest request = HttpRequest.newBuilder(baseUri.resolve(
                            "/api/v1/orgs/test-org/control-tower/device-events"))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("X-Client-Id", "test-tenant")
                    .POST(HttpRequest.BodyPublishers.ofString("""
                            {"events":[{"eventId":"test-1","assetId":"ABCD12","type":"Emergencia",
                            "occurredAt":"2026-01-01T00:00:00Z"}]}
                            """))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(503, response.statusCode(), response.body());
            assertEquals("device events are not enabled",
                    new ObjectMapper().readTree(response.body()).get("error").asText());
        }
    }

    @Test
    void deviceSignalProducerNamesDifferAcrossPods() {
        assertEquals("device-signals-pod-a", producerName("pod-a"));
        assertNotEquals(producerName("pod-a"), producerName("pod-b"));
    }

    private String producerName(String hostname) {
        String property = "mp.messaging.outgoing.device-signals.producerName";
        return new SmallRyeConfigBuilder().addDefaultInterceptors()
                .withDefaultValue(property, config.unwrap(SmallRyeConfig.class).getConfigValue(property).getRawValue())
                .withDefaultValue("HOSTNAME", hostname)
                .build().getValue(property, String.class);
    }

    public static class Profile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.ofEntries(
                    Map.entry("miot.component.all.enabled", "false"),
                    Map.entry("miot.component.symptoms.enabled", "true"),
                    Map.entry("miot.symptoms.cdc.enabled", "false"),
                    Map.entry("miot.symptoms.signal-builder.enabled", "false"),
                    Map.entry("quarkus.devservices.enabled", "false"),
                    // Keep the pool lazy and local; database startup jobs are outside this availability check.
                    Map.entry("quarkus.datasource.jdbc.url", "jdbc:postgresql://127.0.0.1:1/device_events_test"),
                    Map.entry("quarkus.datasource.reactive.url", "postgresql://127.0.0.1:1/device_events_test"),
                    Map.entry("quarkus.datasource.username", "test"),
                    Map.entry("quarkus.datasource.password", "test"),
                    Map.entry("quarkus.datasource.jdbc.initial-size", "0"),
                    Map.entry("quarkus.datasource.jdbc.min-size", "0"),
                    Map.entry("quarkus.datasource.gps.active", "false"),
                    Map.entry("quarkus.datasource.\"gps-read\".active", "false"),
                    Map.entry("quarkus.hibernate-orm.active", "false"),
                    Map.entry("quarkus.arc.exclude-types", FlywayMigrator.class.getName()
                            + ",com.microboxlabs.miot.symptoms.cases.StaleCaseSweep"),
                    Map.entry("quarkus.scheduler.enabled", "false"),
                    Map.entry("quarkus.http.test-port", "0"));
        }

        @Override
        public Set<Class<?>> getEnabledAlternatives() {
            return Set.of(TestOrganizationAccess.class);
        }
    }

    /** Supplies only the request's organization context; this test exercises availability, not IAM. */
    @Alternative
    @ApplicationScoped
    public static class TestOrganizationAccess extends OrganizationAccess {
        private final TenantContext tenant;
        private final OrganizationContext organization;

        protected TestOrganizationAccess() {
            this(null, null);
        }

        @Inject
        public TestOrganizationAccess(TenantContext tenant, OrganizationContext organization) {
            super(tenant, organization, null);
            this.tenant = tenant;
            this.organization = organization;
        }

        @Override
        public Uni<Refusal> enter(String slug, String email, String clientId) {
            tenant.setTenantCode("test-tenant");
            organization.setOrganizationId(slug);
            return Uni.createFrom().nullItem();
        }
    }
}
