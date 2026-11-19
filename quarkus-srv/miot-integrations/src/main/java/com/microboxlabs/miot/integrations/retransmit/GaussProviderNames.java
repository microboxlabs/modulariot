package com.microboxlabs.miot.integrations.retransmit;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowIterator;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.jboss.logging.Logger;

/**
 * Names the signal provider for Gauss {@code eventProvider}: the organization whose
 * {@code tenant_client_id} sent the signal ({@code ingest_client_id}). Uses the
 * normalized organization name ("Acme GPS" → {@code acme-gps}), else the slug.
 */
@ApplicationScoped
public class GaussProviderNames {

    private static final Logger LOG = Logger.getLogger(GaussProviderNames.class);
    private static final Duration TTL = Duration.ofMinutes(10);
    private static final Duration ERROR_TTL = Duration.ofMinutes(1);
    private static final String LOOKUP = """
            SELECT name, slug
            FROM miot_core.organizations
            WHERE tenant_client_id = $1 AND parent_id IS NULL AND active
            ORDER BY id
            LIMIT 1
            """;

    private final Instance<Pool> pool;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    GaussProviderNames(Instance<Pool> pool) {
        this.pool = pool;
    }

    /** Provider name for a tenant client id; empty when no organization has it. */
    public Optional<String> forClientId(String clientId) {
        if (clientId == null || clientId.isBlank()) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        Cached hit = cache.get(clientId);
        if (hit != null && hit.expiresAt().isAfter(now)) {
            return Optional.ofNullable(hit.name());
        }
        try {
            String name = lookup(clientId);
            if (name == null) {
                LOG.warnf("No organization for ingest_client_id=%s; Gauss eventProvider uses the default", clientId);
            }
            cache.put(clientId, new Cached(name, now.plus(TTL)));
            return Optional.ofNullable(name);
        } catch (RuntimeException e) {
            LOG.warnf("Provider lookup failed for ingest_client_id=%s: %s", clientId, e.getMessage());
            cache.put(clientId, new Cached(null, now.plus(ERROR_TTL)));
            return Optional.empty();
        }
    }

    private String lookup(String clientId) {
        RowIterator<Row> rows = pool.get().preparedQuery(LOOKUP)
                .execute(Tuple.of(clientId))
                .await().atMost(Duration.ofSeconds(5))
                .iterator();
        if (!rows.hasNext()) {
            return null;
        }
        Row row = rows.next();
        return providerName(row.getString("name"), row.getString("slug"));
    }

    static String providerName(String name, String slug) {
        String normalized = normalize(name);
        if (normalized != null) {
            return normalized;
        }
        return slug == null || slug.isBlank() ? null : slug.trim();
    }

    /** Lowercase ASCII, runs of other characters become one dash: "Geo Sur Ltda." → geo-sur-ltda. */
    static String normalize(String name) {
        if (name == null) {
            return null;
        }
        String ascii = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String dashed = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        return dashed.isEmpty() ? null : dashed;
    }

    private record Cached(String name, Instant expiresAt) {}
}
