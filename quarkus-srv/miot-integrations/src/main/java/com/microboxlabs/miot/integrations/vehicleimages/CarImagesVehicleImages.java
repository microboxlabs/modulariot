package com.microboxlabs.miot.integrations.vehicleimages;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import com.microboxlabs.miot.core.vehicle.VehicleImages;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.jboss.logging.Logger;

/**
 * {@link VehicleImages} through a {@link ProviderType#CAR_IMAGES} connection: the organization's own, else the
 * platform's. Signed URLs are kept until a minute before they expire; a vehicle the provider does not know is not
 * asked for again for an hour.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class CarImagesVehicleImages implements VehicleImages {

    private static final Logger LOG = Logger.getLogger(CarImagesVehicleImages.class);
    private static final Duration MARGIN = Duration.ofMinutes(1);
    private static final Duration DEFAULT_LIFETIME = Duration.ofMinutes(5);
    private static final Duration UNKNOWN_FOR = Duration.ofHours(1);

    private final IntegrationConnectionResolver resolver;
    private final CarImagesClient client;
    private final Clock clock;
    private final Cache<String, Optional<Image>> cache;

    @Inject
    public CarImagesVehicleImages(IntegrationConnectionResolver resolver, CarImagesClient client) {
        this(resolver, client, Clock.systemUTC());
    }

    CarImagesVehicleImages(IntegrationConnectionResolver resolver, CarImagesClient client, Clock clock) {
        this.resolver = resolver;
        this.client = client;
        this.clock = clock;
        this.cache = Caffeine.newBuilder()
                .maximumSize(10_000)
                .ticker(() -> clock.millis() * 1_000_000L)
                .expireAfter(new Expiry<String, Optional<Image>>() {
                    @Override
                    public long expireAfterCreate(String key, Optional<Image> value, long currentTime) {
                        Duration keep = value.map(i -> Duration.between(clock.instant(), i.expiresAt()).minus(MARGIN))
                                .orElse(UNKNOWN_FOR);
                        return Math.max(0, keep.toNanos());
                    }

                    @Override
                    public long expireAfterUpdate(String key, Optional<Image> value, long currentTime,
                            long currentDuration) {
                        return expireAfterCreate(key, value, currentTime);
                    }

                    @Override
                    public long expireAfterRead(String key, Optional<Image> value, long currentTime,
                            long currentDuration) {
                        return currentDuration;
                    }
                })
                .build();
    }

    @Override
    public Optional<Image> find(String tenantCode, Query query) {
        if (query == null || query.make() == null || query.make().isBlank()) {
            return Optional.empty();
        }
        Optional<ResolvedConnection> connection = connection(tenantCode);
        if (connection.isEmpty()) {
            return Optional.empty();
        }
        Map<String, String> params = params(query);
        String key = connection.get().connectionId() + "|" + params;
        Optional<Image> cached = cache.getIfPresent(key);
        if (cached != null) {
            return cached;
        }
        Optional<Image> found = fetch(connection.get(), params);
        if (found != null) {
            cache.put(key, found);
            return found;
        }
        return Optional.empty();
    }

    /** The organization's connection, else the platform's. */
    private Optional<ResolvedConnection> connection(String tenantCode) {
        for (String tenant : new String[] {tenantCode, PlatformMailService.PLATFORM_TENANT}) {
            if (tenant == null) {
                continue;
            }
            try {
                return Optional.of(resolver.resolve(tenant, ProviderType.CAR_IMAGES));
            } catch (ConnectionResolutionException e) {
                // try the next one
            }
        }
        return Optional.empty();
    }

    /** Empty for a vehicle the provider does not know; null when the call failed and nothing should be cached. */
    private Optional<Image> fetch(ResolvedConnection connection, Map<String, String> params) {
        String apiKey = connection.metadataString(CarImagesKeys.API_KEY);
        String secret = connection.secretString(CarImagesKeys.SECRET);
        if (apiKey == null || secret == null || !client.serves(connection.baseUrl())) {
            return null;
        }
        try {
            CarImagesClient.SignedUrl signed = client.signedUrl(apiKey, secret, params);
            if (signed.url() != null) {
                return Optional.of(new Image(signed.url(), expiresAt(signed.url())));
            }
            if (signed.status() == 404) {
                return Optional.empty();
            }
            LOG.warnf("carimagesapi answered HTTP %d for %s", signed.status(), params);
            return null;
        } catch (IOException e) {
            LOG.warnf("carimagesapi is unreachable: %s", e.getMessage());
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
    }

    private static Map<String, String> params(Query query) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("make", query.make().trim());
        if (query.model() != null && !query.model().isBlank()) {
            params.put("model", query.model().trim());
        }
        if (query.year() != null) {
            params.put("year", query.year().toString());
        }
        if (query.view() != null && !query.view().isBlank()) {
            params.put("view", query.view().trim());
        }
        params.put("width", Integer.toString(query.width() == null ? 800 : query.width()));
        return params;
    }

    /** The signed URL's own {@code expires} (Unix seconds), else five minutes from now. */
    private Instant expiresAt(String url) {
        String query = URI.create(url).getRawQuery();
        if (query != null) {
            for (String pair : query.split("&")) {
                if (pair.startsWith("expires=")) {
                    try {
                        return Instant.ofEpochSecond(Long.parseLong(pair.substring("expires=".length())));
                    } catch (NumberFormatException e) {
                        break;
                    }
                }
            }
        }
        return clock.instant().plus(DEFAULT_LIFETIME);
    }
}
