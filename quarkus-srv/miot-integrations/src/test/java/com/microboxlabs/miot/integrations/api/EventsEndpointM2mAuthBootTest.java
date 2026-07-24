package com.microboxlabs.miot.integrations.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.jose4j.jws.AlgorithmIdentifiers;
import org.jose4j.jws.JsonWebSignature;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.keys.HmacKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Boots the module against a DevServices Postgres and proves the fix at runtime: the
 * {@code /events} endpoint now authenticates ECM's HS256 machine token (because it is
 * {@code @M2MAuth}), while the sibling {@code /bindings} endpoint — which shares the
 * {@code /integrations} prefix — still rejects that same token as a web-user (RS256) call.
 *
 * <p>The tell is the status code. Before the fix an M2M token on {@code /events} was verified
 * against the RS256 web path, failed, and reached {@code OrganizationRequestFilter} anonymous
 * → <b>401</b> ("Cannot resolve caller identity"). After the fix the token verifies, its
 * client id is resolved, and the org-authorization step runs — a mismatched client is a clean
 * <b>403</b>. 401 → 403 is the whole proof: the auth <i>mechanism</i> now accepts the token.
 *
 * <p>No org seeding of a matching client is needed — a 403 already means the token was
 * accepted and authorization ran. The integrations tables are never touched (the request
 * resolves inside the filter), so only the miot_core schema is migrated.
 */
@QuarkusTest
@TestProfile(EventsEndpointM2mAuthBootTest.M2mBootProfile.class)
class EventsEndpointM2mAuthBootTest {

    private static final String ISSUER = "https://mock-oidc.test/";
    private static final String M2M_AUDIENCE = "https://api.miot.test/m2m";
    private static final String HS256_SECRET = "test-hs256-secret-please-rotate-32-bytes-min!";

    private static final String ORG_SLUG = "m2m-events-test";
    private static final String ORG_CLIENT_ID = "authorized-client-id";

    private static final String EVENTS = "/api/v1/orgs/" + ORG_SLUG + "/integrations/events";
    private static final String BINDINGS = "/api/v1/orgs/" + ORG_SLUG + "/integrations/bindings";
    private static final String EVENT_BODY =
            "{\"eventType\":\"review.verdict\",\"scopeKind\":\"activiti_task\","
                    + "\"scopeKey\":\"wfship2:missionControlTask\",\"context\":{},\"eventKey\":\"boot-test\"}";

    @Inject
    Pool pool;

    @BeforeEach
    void seedOrganization() {
        pool.query(
                "INSERT INTO miot_core.organizations (slug, name, tenant_client_id) "
                        + "VALUES ('" + ORG_SLUG + "', 'M2M Events Test', '" + ORG_CLIENT_ID + "') "
                        + "ON CONFLICT (slug) DO NOTHING")
                .execute().await().indefinitely();
    }

    @Test
    void eventsAuthenticatesTheM2mTokenAndReachesOrgAuthorization() {
        // Client id (azp) deliberately differs from the org's tenant_client_id: reaching the
        // 403 at all means the HS256 token was accepted and its client id resolved. Before the
        // fix this same call returned 401 (verified as RS256, rejected, anonymous).
        String token = m2mToken("some-other-client");

        given()
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .body(EVENT_BODY)
                .when().post(EVENTS)
                .then()
                .statusCode(403)
                .body(containsString("M2M client is not authorized"));
    }

    @Test
    void bindingsStillRejectsThatSameM2mTokenAsAWebUserCall() {
        // The bindings resource shares the /integrations prefix but is NOT @M2MAuth, so the
        // HS256 token is verified against the RS256 web path, fails, and is rejected — proving
        // the events fix did not drag the web-user admin endpoints onto M2M auth.
        String token = m2mToken(ORG_CLIENT_ID);

        given()
                .header("Authorization", "Bearer " + token)
                .when().get(BINDINGS)
                .then()
                .statusCode(401);
    }

    @Test
    void eventsRejectsAMissingToken() {
        given()
                .contentType("application/json")
                .body(EVENT_BODY)
                .when().post(EVENTS)
                .then()
                .statusCode(401);
    }

    private static String m2mToken(String clientId) {
        try {
            JwtClaims claims = new JwtClaims();
            claims.setIssuer(ISSUER);
            claims.setAudience(M2M_AUDIENCE);
            claims.setSubject(clientId + "@clients");
            claims.setStringClaim("azp", clientId);
            claims.setIssuedAtToNow();
            claims.setExpirationTimeMinutesInTheFuture(5);

            JsonWebSignature jws = new JsonWebSignature();
            jws.setPayload(claims.toJson());
            jws.setKey(new HmacKey(HS256_SECRET.getBytes(StandardCharsets.UTF_8)));
            jws.setAlgorithmHeaderValue(AlgorithmIdentifiers.HMAC_SHA256);
            return jws.getCompactSerialization();
        } catch (Exception e) {
            throw new IllegalStateException("Could not mint the test M2M token", e);
        }
    }

    /** Boots only the integrations component (conversational/WhatsApp stays off), with the
     * HS256 auth config the M2M token is minted against, and a Flyway-migrated miot_core. */
    public static class M2mBootProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            Map<String, String> c = new HashMap<>();
            c.put("miot.component.integrations.enabled", "true");

            // This test exercises the auth of one endpoint, not the module's schedulers or its
            // optional workers (whose cron/config normally come from miot-cli's
            // application.properties, absent here). Turn them off so their unresolved ${...}
            // placeholders are never evaluated at boot.
            c.put("quarkus.scheduler.enabled", "false");
            c.put("miot.distill.enabled", "false");
            c.put("miot.distill.cron", "off");
            c.put("miot.integrations.retransmit.worker.enabled", "false");

            // HS256/M2M verification matching the token minted above; the client id is the azp.
            c.put("miot.auth.hs256-issuer", ISSUER);
            c.put("miot.auth.hs256-secret", HS256_SECRET);
            c.put("miot.auth.hs256-audience", M2M_AUDIENCE);
            c.put("miot.auth.client-id-claims", "azp");

            // The org-scoped resources are @Authenticated; make that explicit for the test app,
            // which has no application.properties of its own.
            c.put("quarkus.http.auth.permission.api.paths", "/api/*");
            c.put("quarkus.http.auth.permission.api.policy", "authenticated");
            c.put("quarkus.http.auth.permission.public.paths", "/q/*");
            c.put("quarkus.http.auth.permission.public.policy", "permit");

            // Real Alfresco REST clients would trip an unconfigured-baseUri failure; the M2M
            // path never calls them, but keep the stub beans winning as the harness profile does.
            c.put("miot.alfresco.auth", "stub");
            c.put("quarkus.arc.exclude-types",
                    "com.microboxlabs.miot.core.alfresco.RealAlfrescoDirectoryClient,"
                            + "com.microboxlabs.miot.core.alfresco.RealAlfrescoGroupAdminClient,"
                            + "com.microboxlabs.miot.core.alfresco.RealAlfrescoMembershipClient");

            // DevServices Postgres + Flyway runs the miot_core migrations (the organizations
            // table the auth filter resolves against). Integrations tables are not needed.
            c.put("quarkus.datasource.db-kind", "postgresql");
            c.put("quarkus.flyway.migrate-at-start", "true");
            c.put("quarkus.flyway.locations", "db/migration/core");
            c.put("quarkus.flyway.schemas", "miot_core");
            c.put("quarkus.flyway.create-schemas", "true");
            c.put("quarkus.hibernate-orm.schema-management.strategy", "none");
            c.put("quarkus.hibernate-orm.physical-naming-strategy",
                    "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy");
            return c;
        }
    }
}
