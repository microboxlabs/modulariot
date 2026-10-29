package com.microboxlabs.miot.integrations.geocoding;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.geocoding.GeocodingProvider.Candidate;
import com.microboxlabs.miot.integrations.geocoding.GeocodingProvider.Query;
import com.microboxlabs.miot.integrations.service.ConnectionNotConfiguredException;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ManagedCredentials;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;
import org.jboss.logging.Logger;

/**
 * Forward geocoding for an organization. The organization needs its own {@link ProviderType#GEOCODING} connection,
 * with a credential the platform manages, which a platform owner creates. The provider, the token and the cost of a
 * call come from the platform's connection. Without its own connection an organization gets no provider calls.
 * Blocking.
 */
@ApplicationScoped
public class Geocoder {

    private static final Logger LOG = Logger.getLogger(Geocoder.class);

    /**
     * {@code called} is true when the provider answered, which is what a call costs. {@code provider} is null and
     * {@code error} set when no connection can be used.
     */
    public record Result(String provider, boolean called, boolean storable, List<Candidate> candidates,
            BigDecimal costUsd, String error) {

        static Result failed(String provider, String error) {
            return new Result(provider, false, false, List.of(), null, error);
        }
    }

    private final IntegrationConnectionResolver resolver;
    private final List<GeocodingProvider> providers;

    @Inject
    public Geocoder(IntegrationConnectionResolver resolver, Instance<GeocodingProvider> providers) {
        this(resolver, providers.stream().toList());
    }

    public Geocoder(IntegrationConnectionResolver resolver, List<GeocodingProvider> providers) {
        this.resolver = resolver;
        this.providers = providers;
    }

    public Result forward(String tenantCode, Query query) {
        String refused = refusal(tenantCode);
        if (refused != null) {
            return Result.failed(null, refused);
        }
        ResolvedConnection resolved = connection();
        if (resolved == null) {
            return Result.failed(null, "the platform has no geocoding provider");
        }
        GeocodingConnection connection;
        try {
            connection = GeocodingConnection.of(resolved);
        } catch (NumberFormatException e) {
            return Result.failed(null, "the geocoding connection's " + GeocodingConnection.COST
                    + " is not a number");
        }
        GeocodingProvider provider = providers.stream().filter(p -> p.name().equals(connection.provider()))
                .findFirst().orElse(null);
        if (provider == null) {
            return Result.failed(null, "unknown geocoding provider " + connection.provider());
        }
        if (connection.token() == null || connection.token().isBlank()) {
            return Result.failed(provider.name(), "the geocoding connection's credential has no token");
        }
        if (resolved.baseUrl() != null && !provider.serves(resolved.baseUrl())) {
            return Result.failed(provider.name(), "the geocoding connection must use " + provider.baseUrl());
        }
        try {
            List<Candidate> candidates = provider.forward(connection, query);
            return new Result(provider.name(), true, provider.storable(connection), candidates,
                    connection.costPerRequest(), null);
        } catch (IOException e) {
            LOG.warnf("Geocoding through %s failed: %s", provider.name(), e.getMessage());
            return Result.failed(provider.name(), e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.failed(provider.name(), "interrupted");
        }
    }

    /**
     * Why the organization cannot use the provider, or null when it can. The platform tenant uses the platform's
     * connection directly.
     */
    private String refusal(String tenantCode) {
        if (tenantCode == null || tenantCode.isBlank()) {
            return "no organization to geocode for";
        }
        if (PlatformMailService.PLATFORM_TENANT.equals(tenantCode)) {
            return null;
        }
        ResolvedConnection own;
        try {
            own = resolver.resolve(tenantCode, ProviderType.GEOCODING);
        } catch (ConnectionNotConfiguredException e) {
            return "this organization has no geocoding connection; a platform owner adds it in Conexiones";
        } catch (ConnectionResolutionException e) {
            LOG.warnf("The geocoding connection of %s cannot be read: %s", tenantCode, e.getMessage());
            return "this organization's geocoding connection cannot be read";
        }
        return ManagedCredentials.isManaged(own.publicConfig()) ? null
                : "this organization's geocoding connection is not managed by the platform";
    }

    /** The platform's connection, or null when it is missing or its credential cannot be read. */
    private ResolvedConnection connection() {
        try {
            return resolver.resolve(PlatformMailService.PLATFORM_TENANT, ProviderType.GEOCODING);
        } catch (ConnectionNotConfiguredException e) {
            return null;
        } catch (ConnectionResolutionException e) {
            LOG.warnf("The platform geocoding connection cannot be read: %s", e.getMessage());
            return null;
        }
    }
}
