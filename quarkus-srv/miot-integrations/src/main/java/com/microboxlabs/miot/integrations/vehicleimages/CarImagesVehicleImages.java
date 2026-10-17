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
 * asked for again for an hour, and a failed call for two minutes.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class CarImagesVehicleImages implements VehicleImages {

    private static final Logger LOG = Logger.getLogger(CarImagesVehicleImages.class);
    private static final Duration MARGIN = Duration.ofMinutes(1);
    private static final Duration DEFAULT_LIFETIME = Duration.ofMinutes(5);
    private static final Duration MAX_LIFETIME = Duration.ofDays(1);
    private static final Duration UNKNOWN_FOR = Duration.ofHours(1);
    private static final Duration FAILED_FOR = Duration.ofMinutes(2);
    private static final int DEFAULT_WIDTH = 800;

    /** {@code account} is the connection's API key, which is public, so a new key does not reuse old answers. */
    private record Key(String connectionId, String account, String make, String model, Integer year, String view,
            int width) {
    }

    /** {@code image} is null when there is none; {@code until} is when to ask again. */
    private record Entry(Image image, Instant until) {
    }

    private final IntegrationConnectionResolver resolver;
    private final CarImagesClient client;
    private final Clock clock;
    private final Cache<Key, Entry> cache;

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
                .expireAfter(new Expiry<Key, Entry>() {
                    @Override
                    public long expireAfterCreate(Key key, Entry value, long currentTime) {
                        Duration keep = Duration.between(clock.instant(), value.until());
                        return keep.isNegative() ? 0 : keep.toNanos();
                    }

                    @Override
                    public long expireAfterUpdate(Key key, Entry value, long currentTime, long currentDuration) {
                        return expireAfterCreate(key, value, currentTime);
                    }

                    @Override
                    public long expireAfterRead(Key key, Entry value, long currentTime, long currentDuration) {
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
        Key key = new Key(connection.get().connectionId(), connection.get().metadataString(CarImagesKeys.API_KEY),
                query.make().trim(), trimmed(query.model()),
                query.year(), trimmed(query.view()), query.width() == null ? DEFAULT_WIDTH : query.width());
        // Atomic per key, so concurrent misses share one call.
        Entry entry = cache.get(key, k -> fetch(connection.get(), k));
        return Optional.ofNullable(entry.image());
    }

    /** The organization's connection, else the platform's; one that cannot be used is skipped. */
    private Optional<ResolvedConnection> connection(String tenantCode) {
        for (String tenant : new String[] {tenantCode, PlatformMailService.PLATFORM_TENANT}) {
            if (tenant == null) {
                continue;
            }
            try {
                ResolvedConnection connection = resolver.resolve(tenant, ProviderType.CAR_IMAGES);
                if (usable(connection)) {
                    return Optional.of(connection);
                }
            } catch (ConnectionResolutionException e) {
                // try the next one
            }
        }
        return Optional.empty();
    }

    private boolean usable(ResolvedConnection connection) {
        return connection.metadataString(CarImagesKeys.API_KEY) != null
                && connection.secretString(CarImagesKeys.SECRET) != null
                && client.serves(connection.baseUrl());
    }

    private Entry fetch(ResolvedConnection connection, Key key) {
        Map<String, String> params = params(key);
        try {
            CarImagesClient.SignedUrl signed = client.signedUrl(key.account(),
                    connection.secretString(CarImagesKeys.SECRET), params);
            if (signed.url() != null) {
                Instant expiresAt = expiresAt(signed.url());
                return new Entry(new Image(signed.url(), expiresAt), expiresAt.minus(MARGIN));
            }
            if (signed.status() == 404) {
                return none(UNKNOWN_FOR);
            }
            LOG.warnf("carimagesapi answered HTTP %d for %s", signed.status(), params);
        } catch (IOException e) {
            LOG.warnf("carimagesapi is unreachable: %s", e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException e) {
            // The message may quote the secret header, so only the type is logged.
            LOG.warnf("carimagesapi call failed: %s", e.getClass().getName());
        }
        return none(FAILED_FOR);
    }

    private Entry none(Duration keep) {
        return new Entry(null, clock.instant().plus(keep));
    }

    private static Map<String, String> params(Key key) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("make", key.make());
        if (key.model() != null) {
            params.put("model", key.model());
        }
        if (key.year() != null) {
            params.put("year", key.year().toString());
        }
        if (key.view() != null) {
            params.put("view", key.view());
        }
        params.put("width", Integer.toString(key.width()));
        return params;
    }

    private static String trimmed(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** The signed URL's own {@code expires} (Unix seconds), else five minutes from now; at most a day away. */
    private Instant expiresAt(String url) {
        Instant now = clock.instant();
        Instant latest = now.plus(MAX_LIFETIME);
        String query = URI.create(url).getRawQuery();
        if (query != null) {
            for (String pair : query.split("&")) {
                if (pair.startsWith("expires=")) {
                    try {
                        long seconds = Long.parseLong(pair.substring("expires=".length()));
                        return seconds > latest.getEpochSecond() ? latest : Instant.ofEpochSecond(seconds);
                    } catch (NumberFormatException e) {
                        break;
                    }
                }
            }
        }
        return now.plus(DEFAULT_LIFETIME);
    }
}
