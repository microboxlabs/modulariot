package com.microboxlabs.miot.core.auth0;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth0.Auth0Management.M2mClient;
import com.microboxlabs.miot.core.auth0.Auth0ManagementApi.ClientGrant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class Auth0ManagementTest {

    private final FakeAuth0Api api = new FakeAuth0Api();
    private Auth0Management auth0;

    @BeforeEach
    void setUp() {
        auth0 = management(Optional.of("https://tenant.auth0.test/"), Optional.of("https://gps.test/track"));
    }

    private Auth0Management management(Optional<String> domain, Optional<String> audience) {
        return new Auth0Management(domain, Optional.of("id"), Optional.of("secret"), audience,
                "asset:track:write, asset:track:read", "mbl:", () -> api);
    }

    @Test
    void aNewClientIsNamedAfterTheOrganizationAndGrantedTheGpsApi() {
        M2mClient client = auth0.createM2mClient("acme", "Acme").await().indefinitely();

        assertEquals("mbl:acme", client.name());
        assertEquals("non_interactive", api.client(client.clientId()).appType());
        assertEquals(List.of(new ClientGrant(client.clientId(), "https://gps.test/track",
                List.of("asset:track:write", "asset:track:read"))), api.grants());
    }

    @Test
    void aClientWhoseGrantFailsIsDeleted() {
        api.failGrants = true;

        assertThrows(IllegalStateException.class, () -> auth0.createM2mClient("acme", "Acme").await().indefinitely());
        assertTrue(api.clients.isEmpty());
    }

    @Test
    void theManagementTokenIsReused() {
        auth0.createM2mClient("a", "A").await().indefinitely();
        auth0.createM2mClient("b", "B").await().indefinitely();

        assertEquals(1, api.tokenCalls.get());
    }

    @Test
    void theSecretCanBeReadAndRotated() {
        api.add("c1", "mbl:acme", "non_interactive");

        assertEquals("secret-c1", auth0.secret("c1").await().indefinitely());
        String rotated = auth0.rotateSecret("c1").await().indefinitely();
        assertNotEquals("secret-c1", rotated);
        assertEquals(rotated, auth0.secret("c1").await().indefinitely());
    }

    @Test
    void anUnknownClientIsNotFound() {
        assertThrows(NoSuchElementException.class, () -> auth0.secret("missing").await().indefinitely());
    }

    @Test
    void m2mClientsAreReadPageByPageAndSortedByName() {
        IntStream.range(0, 150).forEach(i -> api.add("c" + i, "mbl:p" + (999 - i), "non_interactive"));
        api.add("spa", "web", "spa");

        List<M2mClient> clients = auth0.m2mClients().await().indefinitely();

        assertEquals(150, clients.size());
        assertEquals("mbl:p850", clients.get(0).name());
        assertEquals(List.of(0, 1), api.pagesRead);
    }

    @Test
    void withoutCredentialsNothingIsCalled() {
        Auth0Management unset = management(Optional.empty(), Optional.of("https://gps.test/track"));

        assertFalse(unset.configured());
        assertThrows(IllegalStateException.class, () -> unset.secret("c1").await().indefinitely());
        assertEquals(0, api.tokenCalls.get());
    }

    @Test
    void withoutAnAudienceNoClientIsCreated() {
        Auth0Management noAudience = management(Optional.of("tenant.auth0.test"), Optional.empty());

        assertThrows(IllegalStateException.class,
                () -> noAudience.createM2mClient("acme", "Acme").await().indefinitely());
        assertTrue(api.clients.isEmpty());
    }

    @Test
    void theDomainBecomesAnHttpsUrl() {
        assertEquals("https://tenant.auth0.test", Auth0Management.baseUrl("tenant.auth0.test"));
        assertEquals("https://tenant.auth0.test", Auth0Management.baseUrl("https://tenant.auth0.test/"));
        assertEquals(Optional.of("https://tenant.auth0.test/oauth/token"), auth0.tokenUrl());
        assertNull(management(Optional.empty(), Optional.empty()).tokenUrl().orElse(null));
    }
}
