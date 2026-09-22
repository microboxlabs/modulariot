package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.dto.AppliedAuthResponse;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.service.CredentialAuthResolver;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * What the credential endpoint answers. The slug lookup needs a database and
 * is not covered here.
 */
class DashboardCredentialsResourceTest {

    private static final String KEY = "0123456789abcdef0123456789abcdef";
    private static final String TENANT = "tenant-1";
    private static final String REF = "fleet";

    @Test
    void acceptsOnlyTheConfiguredKey() {
        assertTrue(DashboardCredentialsResource.keyAccepted(KEY, KEY));
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, KEY + "x"));
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, KEY.substring(1)));
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, "0123456789abcdef0123456789abcdeF"));
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, ""));
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, null));
    }

    /**
     * {@code quarkus.http.auth.permission.api} refuses anything under
     * {@code /api/*} that carries no token, and this caller carries none. A
     * path moved back there would 401 before the key check runs.
     */
    @Test
    void staysOffTheAuthenticatedPathPrefix() {
        String path = DashboardCredentialsResource.class.getAnnotation(Path.class).value();

        assertTrue(path.startsWith(DashboardCredentialsResource.PATH));
        assertFalse(path.startsWith("/api/"));
    }

    @Test
    void refusesWhenNoKeyIsConfigured() {
        Response response = resource(Optional.empty(), auth()).resolve(TENANT, REF, KEY).await().indefinitely();

        assertEquals(503, response.getStatus());
        assertNoStore(response);
    }

    @Test
    void refusesAKeyThatDoesNotMatch() {
        Response response =
                resource(Optional.of(KEY), auth()).resolve(TENANT, REF, "wrong").await().indefinitely();

        assertEquals(401, response.getStatus());
        assertNoStore(response);
    }

    @Test
    void answersTheAppliedAuth() {
        Response response = resource(Optional.of(KEY), auth()).applied(TENANT, REF);

        assertEquals(200, response.getStatus());
        assertEquals("HTTP_AUTH", ((AppliedAuthResponse) response.getEntity()).kind());
        assertNoStore(response);
    }

    @Test
    void answersNotFoundForAnUnknownCredential() {
        Response response = resource(Optional.of(KEY), null).applied(TENANT, REF);

        assertEquals(404, response.getStatus());
        assertNoStore(response);
    }

    @Test
    void answersServerErrorWhenTheGrantCannotRun() {
        CredentialAuthResolver failing = new CredentialAuthResolver(null, null, null) {
            @Override
            public ResolvedAuth resolve(String tenantCode, String credentialRef) {
                throw new AuthResolutionException("No credential auth provider is registered for BASIC");
            }
        };

        Response response = resource(Optional.of(KEY), null, failing).applied(TENANT, REF);

        assertEquals(500, response.getStatus());
        assertNoStore(response);
    }

    @Test
    void mapsResolvedAuthOntoTheWire() {
        Instant expiry = Instant.parse("2026-09-21T04:00:00Z");

        AppliedAuthResponse body = AppliedAuthResponse.httpAuth(new ResolvedAuth(
                Map.of("Authorization", "Bearer t"), Map.of("api_key", "k"), expiry));

        assertEquals("HTTP_AUTH", body.kind());
        assertEquals(Map.of("Authorization", "Bearer t"), body.headers());
        assertEquals(Map.of("api_key", "k"), body.queryParams());
        assertEquals("2026-09-21T04:00:00Z", body.expiresAt());
    }

    /** The dashboard server refuses an {@code expiresAt} it cannot parse. */
    @Test
    void omitsAnExpiryTheGrantDidNotState() {
        AppliedAuthResponse body =
                AppliedAuthResponse.httpAuth(ResolvedAuth.headers(Map.of("Authorization", "Bearer t"), null));

        assertNull(body.expiresAt());
        assertEquals(Map.of(), body.queryParams());
    }

    private static void assertNoStore(Response response) {
        assertEquals("no-store", response.getHeaderString(HttpHeaders.CACHE_CONTROL));
    }

    private static ResolvedAuth auth() {
        return ResolvedAuth.headers(Map.of("Authorization", "Bearer t"), null);
    }

    private static DashboardCredentialsResource resource(Optional<String> proxyKey, ResolvedAuth answer) {
        return resource(proxyKey, answer, null);
    }

    private static DashboardCredentialsResource resource(
            Optional<String> proxyKey, ResolvedAuth answer, CredentialAuthResolver override) {
        CredentialAuthResolver resolver = override != null ? override : stub(answer);
        return new DashboardCredentialsResource(resolver, proxyKey);
    }

    /** Stands in for the lookup, which has its own test. */
    private static CredentialAuthResolver stub(ResolvedAuth answer) {
        return new CredentialAuthResolver(new NoCredentials(), null, null) {
            @Override
            public ResolvedAuth resolve(String tenantCode, String credentialRef) {
                return answer;
            }
        };
    }

    private static class NoCredentials extends CredentialProfileRepository {
        NoCredentials() {
            super(null);
        }
    }
}
