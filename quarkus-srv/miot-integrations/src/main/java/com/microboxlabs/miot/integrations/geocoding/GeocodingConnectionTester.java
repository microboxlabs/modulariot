package com.microboxlabs.miot.integrations.geocoding;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import com.microboxlabs.miot.integrations.service.ConnectionNotConfiguredException;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.tester.ConnectionTester;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.time.OffsetDateTime;

/**
 * Tests a GEOCODING connection through the platform's provider, which holds the token; an organization's managed
 * connection has none of its own. Mapbox is checked on its token endpoint at no cost. Google has no such endpoint,
 * so one address is geocoded, which counts as one request.
 */
@ApplicationScoped
public class GeocodingConnectionTester implements ConnectionTester {

    private static final GeocodingProvider.Query PROBE = new GeocodingProvider.Query("Santiago", null, "cl");

    private final IntegrationConnectionResolver resolver;
    private final MapboxCredentialTester mapbox;
    private final GoogleGeocoding google;

    @Inject
    public GeocodingConnectionTester(IntegrationConnectionResolver resolver, MapboxCredentialTester mapbox,
            GoogleGeocoding google) {
        this.resolver = resolver;
        this.mapbox = mapbox;
        this.google = google;
    }

    @Override
    public boolean supports(ProviderType providerType) {
        return providerType == ProviderType.GEOCODING;
    }

    /** The result is about the platform's credential, not the organization's managed one. */
    @Override
    public boolean validatesCredential() {
        return false;
    }

    @Override
    public ConnectionTestResponse test(IntegrationConnection connection, CredentialProfile credential,
            ConnectionTestRequest request) {
        GeocodingConnection platform;
        try {
            platform = GeocodingConnection.of(resolver.resolve(PLATFORM_TENANT, ProviderType.GEOCODING));
        } catch (ConnectionNotConfiguredException e) {
            return fail("The platform has no geocoding provider; set it in the Plataforma scope");
        } catch (ConnectionResolutionException | IllegalArgumentException e) {
            return fail("The platform's geocoding connection cannot be read: " + e.getMessage());
        }
        if (GoogleGeocoding.PROVIDER_NAME.equals(platform.provider())) {
            return testGoogle(platform);
        }
        CredentialTestResponse result = mapbox.check(platform.token());
        return new ConnectionTestResponse(result.success(), result.testedAt(), result.message());
    }

    private ConnectionTestResponse testGoogle(GeocodingConnection platform) {
        if (platform.token() == null || platform.token().isBlank()) {
            return fail("The platform's credential has no token");
        }
        try {
            google.forward(platform, PROBE);
            return new ConnectionTestResponse(true, OffsetDateTime.now(), "Google accepted the API key");
        } catch (IOException e) {
            return fail(e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return fail("The Google check was interrupted");
        }
    }

    private static ConnectionTestResponse fail(String message) {
        return new ConnectionTestResponse(false, OffsetDateTime.now(), message);
    }
}
