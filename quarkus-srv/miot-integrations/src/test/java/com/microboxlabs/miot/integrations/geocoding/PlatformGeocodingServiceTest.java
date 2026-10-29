package com.microboxlabs.miot.integrations.geocoding;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.geocoding.PlatformGeocodingService.PlatformGeocodingView;
import com.microboxlabs.miot.integrations.geocoding.PlatformGeocodingService.SetPlatformGeocodingRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PlatformGeocodingServiceTest {

    private final FakeConnections repository = new FakeConnections();
    private final FakeCredentials credentials = new FakeCredentials();
    private final PlatformGeocodingService service = new PlatformGeocodingService(
            new IntegrationConnectionService(null, credentials, repository, null, null, new NoBindings(), null), repository,
            credentials, List.of(new MapboxGeocoding(URI.create("https://api.mapbox.com")),
                    new GoogleGeocoding(URI.create("https://maps.googleapis.com"), false)));

    @Test
    void nothingIsConfiguredAtFirst() {
        assertFalse(service.get().configured());
    }

    @Test
    void theFirstSaveLinksThePlatformCredentialWithOurCost() {
        PlatformGeocodingView view = service.put(
                new SetPlatformGeocodingRequest(null, "cred-mapbox", null, new BigDecimal("0.0075")), "owner");

        assertTrue(view.configured());
        assertEquals("mapbox", view.provider());
        assertEquals(Boolean.TRUE, view.permanent());
        assertEquals(new BigDecimal("0.0075"), view.costPerRequestUsd());
        assertEquals("cred-mapbox", view.credentialProfileId());
        assertEquals("Mapbox", view.credentialName());
        IntegrationConnection c = repository.connection;
        assertEquals(PLATFORM_TENANT, c.tenantCode());
        assertEquals(ProviderType.GEOCODING, c.providerType());
        assertEquals(URI.create("https://api.mapbox.com"), c.baseUrl());
        assertEquals("cred-mapbox", c.credentialProfileId());
    }

    @Test
    void aCredentialIsRequiredTheFirstTime() {
        assertThrows(IllegalArgumentException.class,
                () -> service.put(new SetPlatformGeocodingRequest("mapbox", " ", true, null), "owner"));
        assertNull(repository.connection);
    }

    @Test
    void onlyAPlatformBearerTokenCredentialIsAccepted() {
        assertThrows(IllegalArgumentException.class,
                () -> service.put(new SetPlatformGeocodingRequest("mapbox", "cred-basic", null, null), "owner"));
        assertThrows(IllegalArgumentException.class,
                () -> service.put(new SetPlatformGeocodingRequest("mapbox", "cred-managed", null, null), "owner"));
        assertThrows(IllegalArgumentException.class,
                () -> service.put(new SetPlatformGeocodingRequest("mapbox", "missing", null, null), "owner"));
        assertNull(repository.connection);
    }

    @Test
    void switchingToGoogleKeepsTheCredentialAndDropsPermanent() {
        service.put(new SetPlatformGeocodingRequest("mapbox", "cred-mapbox", false, null), "owner");

        PlatformGeocodingView view = service.put(
                new SetPlatformGeocodingRequest("google", null, true, new BigDecimal("0.005")), "owner");

        assertEquals("google", view.provider());
        assertNull(view.permanent());
        assertEquals(URI.create("https://maps.googleapis.com"), repository.connection.baseUrl());
        assertEquals("cred-mapbox", repository.connection.credentialProfileId());
    }

    @Test
    void removingTheProviderKeepsTheCredential() {
        service.put(new SetPlatformGeocodingRequest("mapbox", "cred-mapbox", null, null), "owner");

        assertTrue(service.delete("owner"));

        assertNull(repository.connection);
        assertEquals("Mapbox", credentials.get(PLATFORM_TENANT, "cred-mapbox").displayName());
    }

    @Test
    void anUnknownProviderOrANegativeCostIsRefused() {
        assertThrows(IllegalArgumentException.class,
                () -> service.put(new SetPlatformGeocodingRequest("here", "cred-mapbox", null, null), "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.put(
                new SetPlatformGeocodingRequest("mapbox", "cred-mapbox", null, new BigDecimal("-1")), "owner"));
    }

    private static final class FakeConnections extends IntegrationConnectionRepository {
        private IntegrationConnection connection;

        private FakeConnections() {
            super(null);
        }

        @Override
        public IntegrationConnection findActiveByProvider(String tenantCode, ProviderType providerType) {
            return connection != null && connection.tenantCode().equals(tenantCode)
                    && connection.providerType() == providerType ? connection : null;
        }

        @Override
        public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
            return connection != null && connection.id().equals(connectionId) ? connection : null;
        }

        @Override
        public boolean softDelete(String tenantCode, String connectionId) {
            connection = null;
            return true;
        }

        @Override
        public IntegrationConnection create(IntegrationConnection c) {
            connection = c;
            return c;
        }

        @Override
        public IntegrationConnection update(String tenantCode, String connectionId, String name, String baseUrl,
                String credentialProfileId, Map<String, Object> metadata) {
            IntegrationConnection c = connection;
            connection = new IntegrationConnection(c.id(), c.tenantCode(), c.name(), c.providerType(),
                    baseUrl == null ? c.baseUrl() : URI.create(baseUrl),
                    credentialProfileId == null ? c.credentialProfileId() : credentialProfileId, c.status(),
                    null, null, metadata == null ? c.metadata() : metadata, null);
            return connection;
        }
    }

    private static final class NoBindings extends IntegrationEventBindingRepository {
        private NoBindings() {
            super(null);
        }

        @Override
        public int countByConnection(String connectionId) {
            return 0;
        }
    }

    private static final class FakeCredentials extends CredentialProfileService {
        private final List<CredentialProfileResponse> stored = List.of(
                credential("cred-mapbox", "Mapbox", AuthType.BEARER_TOKEN, Map.of()),
                credential("cred-basic", "Basic", AuthType.BASIC, Map.of()),
                credential("cred-managed", "Managed", AuthType.BEARER_TOKEN, Map.of("managed", true)));

        private FakeCredentials() {
            super(null, null, null, null);
        }

        private static CredentialProfileResponse credential(String id, String name, AuthType authType,
                Map<String, Object> publicConfig) {
            return new CredentialProfileResponse(id, PLATFORM_TENANT, name, null, authType, null, publicConfig, null,
                    null, 1, null, null, List.of(), null, null, null, null);
        }

        @Override
        public CredentialProfileResponse get(String tenantCode, String id) {
            return stored.stream().filter(c -> c.tenantCode().equals(tenantCode) && c.id().equals(id)).findFirst()
                    .orElse(null);
        }
    }
}
