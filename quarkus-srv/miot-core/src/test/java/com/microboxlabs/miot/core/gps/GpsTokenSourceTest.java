package com.microboxlabs.miot.core.gps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth0.FakeAuth0Management;
import com.microboxlabs.miot.core.iam.ServiceAccountTokenIssuer.IssuedToken;
import com.microboxlabs.miot.core.model.Organization;
import io.smallrye.mutiny.Uni;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GpsTokenSourceTest {

    private static final String CLIENT = "client-token-test";

    private final FakeAuth0Management auth0 = new FakeAuth0Management();
    private final FakeGpsTokenApi api = new FakeGpsTokenApi();
    private final Organization org = new Organization();

    @BeforeEach
    void setUp() {
        auth0.api().reset();
        auth0.api().add(CLIENT, "test:acme", "non_interactive");
        api.reset();
        org.tenantClientId = CLIENT;
    }

    private GpsTokenSource source(Optional<String> url) {
        return new GpsTokenSource(auth0, url, () -> api);
    }

    private static Object await(Uni<?> call) {
        return call.await().indefinitely();
    }

    @Test
    void theTokenEndpointGetsTheApplicationsSecretAndTheGpsAudience() {
        IssuedToken token = source(Optional.of("http://token.test")).issue(org).await().indefinitely();

        assertEquals(1, api.requests.size());
        var request = api.requests.get(0);
        assertEquals(CLIENT, request.clientId());
        assertEquals("secret-" + CLIENT, request.clientSecret());
        assertEquals(FakeAuth0Management.AUDIENCE, request.audience());
        assertEquals("client_credentials", request.grantType());
        assertTrue(token.accessToken().contains("."));
    }

    @Test
    void theExpiryComesFromTheTokenNotFromExpiresIn() {
        Instant exp = Instant.now().plusSeconds(120).truncatedTo(ChronoUnit.SECONDS);
        api.expiresAt = exp;
        api.expiresIn = 86400L;

        assertEquals(exp, source(Optional.of("http://token.test")).issue(org).await().indefinitely().expiresAt());
    }

    @Test
    void anOpaqueTokenUsesExpiresIn() {
        Instant before = Instant.now();
        IssuedToken token = GpsTokenSource.issued(new GpsTokenApi.TokenResponse("opaque", 600L));
        assertTrue(!token.expiresAt().isBefore(before.plusSeconds(600)));
        assertTrue(token.expiresAt().isBefore(before.plusSeconds(700)));
    }

    @Test
    void withoutATokenEndpointNothingIsRequested() {
        Uni<?> blank = source(Optional.of(" ")).issue(org);
        assertThrows(IllegalStateException.class, () -> await(blank));
        Uni<?> none = source(Optional.empty()).issue(org);
        assertThrows(IllegalStateException.class, () -> await(none));
        assertTrue(api.requests.isEmpty());
    }

    @Test
    void aRefusalBecomesAConflict() {
        api.refuseWith = 401;
        Uni<?> call = source(Optional.of("http://token.test")).issue(org);
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> await(call));
        assertTrue(e.getMessage().contains("401"));
    }
}
