package com.microboxlabs.miot.integrations.geocoding;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.geocoding.PlatformGeocodingService.PlatformGeocodingView;
import com.microboxlabs.miot.integrations.geocoding.PlatformGeocodingService.SetPlatformGeocodingRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import java.math.BigDecimal;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PlatformGeocodingServiceTest {

    private final FakeConnections repository = new FakeConnections();
    private final FakeCredentials credentials = new FakeCredentials();
    private final PlatformGeocodingService service = new PlatformGeocodingService(
            new IntegrationConnectionService(null, credentials, repository, null, null, null, null), repository,
            credentials, List.of(new MapboxGeocoding(URI.create("https://api.mapbox.com")),
                    new GoogleGeocoding(URI.create("https://maps.googleapis.com"), false)));

    @Test
    void aMissingBodyIsAnInvalidConfiguration() {
        assertThrows(IllegalArgumentException.class, () -> service.put(null, "owner"));
        assertNull(repository.connection);
    }

    @Test
    void nothingIsConfiguredAtFirst() {
        assertFalse(service.get().configured());
    }

    @Test
    void theFirstSaveCreatesThePlatformConnectionWithOurCost() {
        PlatformGeocodingView view = service.put(
                new SetPlatformGeocodingRequest(null, "pk.secret", null, new BigDecimal("0.0075")), "owner");

        assertTrue(view.configured());
        assertEquals("mapbox", view.provider());
        assertEquals(Boolean.TRUE, view.permanent());
        assertEquals(new BigDecimal("0.0075"), view.costPerRequestUsd());
        assertEquals("pk.***", view.tokenPreview());
        IntegrationConnection c = repository.connection;
        assertEquals(PLATFORM_TENANT, c.tenantCode());
        assertEquals(ProviderType.GEOCODING, c.providerType());
        assertEquals(URI.create("https://api.mapbox.com"), c.baseUrl());
        assertEquals(Map.of("token", "pk.secret"), credentials.secret);
    }

    @Test
    void aTokenIsRequiredTheFirstTime() {
        assertThrows(IllegalArgumentException.class,
                () -> service.put(new SetPlatformGeocodingRequest("mapbox", " ", true, null), "owner"));
        assertNull(repository.connection);
    }

    @Test
    void switchingToGoogleKeepsTheTokenAndDropsPermanent() {
        service.put(new SetPlatformGeocodingRequest("mapbox", "pk.secret", false, null), "owner");

        PlatformGeocodingView view = service.put(
                new SetPlatformGeocodingRequest("google", "", true, new BigDecimal("0.005")), "owner");

        assertEquals("google", view.provider());
        assertNull(view.permanent());
        assertEquals(URI.create("https://maps.googleapis.com"), repository.connection.baseUrl());
        assertEquals(Map.of("token", "pk.secret"), credentials.secret);
    }

    @Test
    void anUnknownProviderOrANegativeCostIsRefused() {
        assertThrows(IllegalArgumentException.class,
                () -> service.put(new SetPlatformGeocodingRequest("here", "t", null, null), "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.put(
                new SetPlatformGeocodingRequest("mapbox", "t", null, new BigDecimal("-1")), "owner"));
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
        public IntegrationConnection create(IntegrationConnection c) {
            connection = c;
            return c;
        }

        @Override
        public IntegrationConnection update(String tenantCode, String connectionId, String name, String baseUrl,
                String credentialProfileId, Map<String, Object> metadata) {
            IntegrationConnection c = connection;
            connection = new IntegrationConnection(c.id(), c.tenantCode(), c.name(), c.providerType(),
                    baseUrl == null ? c.baseUrl() : URI.create(baseUrl), c.credentialProfileId(), c.status(),
                    null, null, metadata == null ? c.metadata() : metadata, null);
            return connection;
        }
    }

    private static final class FakeCredentials extends CredentialProfileService {
        private final List<CredentialProfileResponse> stored = new ArrayList<>();
        private Map<String, Object> secret;

        private FakeCredentials() {
            super(null, null, null, null);
        }

        @Override
        public CredentialProfileResponse create(String tenantCode, String actor, CreateCredentialProfileRequest req) {
            secret = req.secretConfig();
            CredentialProfileResponse r = new CredentialProfileResponse("cred-1", tenantCode, req.displayName(),
                    null, req.authType(), null, Map.of(), null, "pk.***", 1, null, null, List.of(), null, null,
                    actor, actor);
            stored.add(r);
            return r;
        }

        @Override
        public List<CredentialProfileResponse> list(String tenantCode) {
            return List.copyOf(stored);
        }

        @Override
        public CredentialProfileResponse get(String tenantCode, String id) {
            return stored.stream().filter(c -> c.id().equals(id)).findFirst().orElse(null);
        }

        @Override
        public CredentialProfile rotateSecret(String tenantCode, String id, Map<String, Object> secretConfig) {
            secret = secretConfig;
            return new CredentialProfile(id, tenantCode, "Platform geocoding", null, null, null, Map.of(), null,
                    null, 2, null, null, null, null, null, null);
        }
    }
}
