package com.microboxlabs.miot.core.api;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.any;
import static com.github.tomakehurst.wiremock.client.WireMock.anyRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.anyUrl;
import static com.github.tomakehurst.wiremock.client.WireMock.deleteRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.equalToJson;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.putRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationPermissionDefinition;
import com.microboxlabs.miot.core.permission.OrganizationPermissionService;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.core.Vertx;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Proxy;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The trainer's knowledge and learning routes, against a stub harness. */
class HarnessProxyResourceLearningTest {

    private static final String SLUG = "org-a";
    private static final String TENANT = "tenant-client-a";
    private static final String EMAIL = "trainer@example.com";

    private Vertx vertx;
    private WireMockServer harness;

    @BeforeEach
    void start() {
        vertx = Vertx.vertx();
        harness = new WireMockServer(options().dynamicPort());
        harness.start();
        harness.stubFor(any(anyUrl()).willReturn(aResponse()
                .withStatus(200)
                .withHeader("Content-Type", "application/json")
                .withBody("{\"ok\":true}")));
    }

    @AfterEach
    void stop() {
        harness.stop();
        vertx.closeAndAwait();
    }

    @Test
    void nonTrainersNeverReachTheHarness() {
        var resource = resource(false, Duration.ofSeconds(5));

        Uni<Response> read = resource.getKnowledge(
                SLUG, "layers", "Bearer t", uriInfo(new MultivaluedHashMap<>()));
        Uni<Response> evaluate = resource.postLearning(
                SLUG, "evaluations", "Bearer t", uriInfo(new MultivaluedHashMap<>()), "{}");

        assertThrows(ForbiddenException.class, read.await()::indefinitely);
        assertThrows(ForbiddenException.class, evaluate.await()::indefinitely);
        harness.verify(0, anyRequestedFor(anyUrl()));
    }

    @Test
    void theOrganizationsTenantReplacesTheCallers() {
        MultivaluedMap<String, String> query = new MultivaluedHashMap<>();
        query.add("tenant_id", "someone-else");
        query.add("target", "conn a");

        Response response = resource(true, Duration.ofSeconds(5))
                .getKnowledge(SLUG, "items/fact/card-1", "Bearer t", uriInfo(query))
                .await().indefinitely();

        assertEquals(200, response.getStatus());
        assertEquals("{\"ok\":true}", response.getEntity());
        harness.verify(getRequestedFor(urlPathEqualTo("/knowledge/items/fact/card-1"))
                .withQueryParam("tenant_id", equalTo(TENANT))
                .withQueryParam("target", equalTo("conn a"))
                .withHeader("X-Miot-Tenant-Client-Id", equalTo(TENANT))
                .withHeader("X-Miot-User-Email", equalTo(EMAIL))
                .withHeader("Authorization", equalTo("Bearer t")));
    }

    @Test
    void evaluationBodiesCarryTheOrganizationsTenant() {
        resource(true, Duration.ofSeconds(5))
                .postLearning(SLUG, "evaluations", "Bearer t", uriInfo(new MultivaluedHashMap<>()),
                        "{\"tenant_id\":\"someone-else\",\"cases\":[]}")
                .await().indefinitely();

        harness.verify(postRequestedFor(urlPathEqualTo("/learning/evaluations"))
                .withQueryParam("tenant_id", equalTo(TENANT))
                .withRequestBody(equalToJson("{\"tenant_id\":\"" + TENANT + "\",\"cases\":[]}")));
    }

    @Test
    void knowledgeWritesAreAuthoredByTheCaller() {
        var resource = resource(true, Duration.ofSeconds(5));
        MultivaluedMap<String, String> query = new MultivaluedHashMap<>();
        query.add("author", "somebody");
        query.add("reason", "stale");

        resource.putKnowledge(SLUG, "items/rule/glossary", "Bearer t", uriInfo(new MultivaluedHashMap<>()),
                        "{\"title\":\"T\",\"content\":\"C\",\"author\":\"somebody\"}")
                .await().indefinitely();
        resource.deleteKnowledge(SLUG, "items/rule/glossary", "Bearer t", uriInfo(query))
                .await().indefinitely();

        harness.verify(putRequestedFor(urlPathEqualTo("/knowledge/items/rule/glossary"))
                .withRequestBody(equalToJson(
                        "{\"title\":\"T\",\"content\":\"C\",\"author\":\"" + EMAIL + "\"}")));
        harness.verify(deleteRequestedFor(urlPathEqualTo("/knowledge/items/rule/glossary"))
                .withQueryParam("author", equalTo(EMAIL))
                .withQueryParam("reason", equalTo("stale")));
    }

    @Test
    void harnessClientErrorsPassThrough() {
        harness.stubFor(any(urlPathEqualTo("/knowledge/items/fact/missing")).willReturn(aResponse()
                .withStatus(404)
                .withHeader("Content-Type", "application/json")
                .withBody("{\"detail\":\"not found\"}")));

        Response response = resource(true, Duration.ofSeconds(5))
                .getKnowledge(SLUG, "items/fact/missing", "Bearer t", uriInfo(new MultivaluedHashMap<>()))
                .await().indefinitely();

        assertEquals(404, response.getStatus());
        assertEquals("{\"detail\":\"not found\"}", response.getEntity());
    }

    @Test
    void harnessServerErrorsAndTimeoutsAreBadGateway() {
        harness.stubFor(any(urlPathEqualTo("/learning/evaluations/broken"))
                .willReturn(aResponse().withStatus(500).withBody("boom")));
        harness.stubFor(any(urlPathEqualTo("/learning/evaluations/slow"))
                .willReturn(aResponse().withStatus(200).withFixedDelay(2_000)));
        var resource = resource(true, Duration.ofMillis(300));

        assertEquals(502, resource.getLearning(SLUG, "evaluations/broken", "Bearer t",
                uriInfo(new MultivaluedHashMap<>())).await().indefinitely().getStatus());
        assertEquals(502, resource.getLearning(SLUG, "evaluations/slow", "Bearer t",
                uriInfo(new MultivaluedHashMap<>())).await().indefinitely().getStatus());
    }

    @Test
    void dotSegmentsCannotLeaveTheArea() {
        Response response = resource(true, Duration.ofSeconds(5))
                .getKnowledge(SLUG, "../runs", "Bearer t", uriInfo(new MultivaluedHashMap<>()))
                .await().indefinitely();

        assertEquals(400, response.getStatus());
        assertNull(HarnessLearningProxy.encodePath("items//x"));
        assertEquals("items/fact/a%20b", HarnessLearningProxy.encodePath("items/fact/a b"));
        harness.verify(0, anyRequestedFor(anyUrl()));
    }

    private HarnessProxyResource resource(boolean trainer, Duration timeout) {
        var organization = new OrganizationContext();
        organization.setUserEmail(EMAIL);
        var tenant = new TenantContext();
        tenant.setClientId(TENANT);
        return new HarnessProxyResource(null, tenant, organization, null,
                new FixedPermissionService(trainer), vertx, "http://localhost:" + harness.port(), timeout);
    }

    private static UriInfo uriInfo(MultivaluedMap<String, String> query) {
        return (UriInfo) Proxy.newProxyInstance(
                UriInfo.class.getClassLoader(),
                new Class<?>[] {UriInfo.class},
                (proxy, method, args) -> {
                    if ("getQueryParameters".equals(method.getName())) {
                        return query;
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
    }

    private static final class FixedPermissionService extends OrganizationPermissionService {
        private final boolean allowed;

        FixedPermissionService(boolean allowed) {
            super(null, null);
            this.allowed = allowed;
        }

        @Override
        public Uni<Void> requirePermission(
                String organizationSlug, OrganizationPermissionDefinition permission) {
            return allowed
                    ? Uni.createFrom().voidItem()
                    : Uni.createFrom().failure(new ForbiddenException("trainer required"));
        }
    }
}
