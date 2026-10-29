package com.microboxlabs.miot.integrations.geocoding;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.geocoding.GeocodingProvider.Candidate;
import com.microboxlabs.miot.integrations.geocoding.GeocodingProvider.Query;
import com.microboxlabs.miot.integrations.service.ConnectionNotConfiguredException;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import org.jboss.logging.Logger;

/**
 * Forward geocoding through the platform's {@link ProviderType#GEOCODING} connection. The platform contracts and
 * pays the provider; organizations never have their own connection. The connection picks the provider. Blocking.
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
    private final GeocodingMetrics metrics;

    @Inject
    public Geocoder(IntegrationConnectionResolver resolver, Instance<GeocodingProvider> providers,
            GeocodingMetrics metrics) {
        this(resolver, providers.stream().toList(), metrics);
    }

    public Geocoder(IntegrationConnectionResolver resolver, List<GeocodingProvider> providers) {
        this(resolver, providers, GeocodingMetrics.NONE);
    }

    public Geocoder(IntegrationConnectionResolver resolver, List<GeocodingProvider> providers,
            GeocodingMetrics metrics) {
        this.resolver = resolver;
        this.providers = providers;
        this.metrics = metrics;
    }

    public Result forward(Query query) {
        ResolvedConnection resolved = connection();
        if (resolved == null) {
            metrics.providerError(null, "no_connection");
            return Result.failed(null, "no geocoding connection is configured");
        }
        GeocodingConnection connection;
        try {
            connection = GeocodingConnection.of(resolved);
        } catch (NumberFormatException e) {
            metrics.providerError(null, "config");
            return Result.failed(null, "the geocoding connection's " + GeocodingConnection.COST
                    + " is not a number");
        }
        GeocodingProvider provider = providers.stream().filter(p -> p.name().equals(connection.provider()))
                .findFirst().orElse(null);
        if (provider == null) {
            metrics.providerError(connection.provider(), "config");
            return Result.failed(null, "unknown geocoding provider " + connection.provider());
        }
        if (connection.token() == null || connection.token().isBlank()) {
            metrics.providerError(provider.name(), "config");
            return Result.failed(provider.name(), "the geocoding connection's credential has no token");
        }
        if (resolved.baseUrl() != null && !provider.serves(resolved.baseUrl())) {
            metrics.providerError(provider.name(), "config");
            return Result.failed(provider.name(), "the geocoding connection must use " + provider.baseUrl());
        }
        long started = System.nanoTime();
        try {
            List<Candidate> candidates = provider.forward(connection, query);
            metrics.providerCall(provider.name(), candidates.isEmpty() ? "empty" : "found",
                    Duration.ofNanos(System.nanoTime() - started));
            return new Result(provider.name(), true, provider.storable(connection), candidates,
                    connection.costPerRequest(), null);
        } catch (IOException e) {
            LOG.warnf("Geocoding through %s failed: %s", provider.name(), e.getMessage());
            metrics.providerError(provider.name(), "io");
            return Result.failed(provider.name(), e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            metrics.providerError(provider.name(), "interrupted");
            return Result.failed(provider.name(), "interrupted");
        }
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
