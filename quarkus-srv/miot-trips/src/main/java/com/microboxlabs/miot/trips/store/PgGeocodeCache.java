package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;

import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.Optional;
import java.util.function.Supplier;

/** {@link GeocodeCache} on {@code miot_trips.geocode_cache}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgGeocodeCache implements GeocodeCache {

    private final Supplier<Pool> pool;

    @Inject
    PgGeocodeCache(Instance<Pool> pool) {
        this(pool::get);
    }

    PgGeocodeCache(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Optional<Entry> find(String addressKey, String country) {
        var rows = query(pool.get(), """
                SELECT latitude, longitude, source, provider, resolved_at FROM miot_trips.geocode_cache
                WHERE address_key = $1 AND country = $2""", Tuple.of(addressKey, country));
        if (!rows.iterator().hasNext()) {
            return Optional.empty();
        }
        Row r = rows.iterator().next();
        return Optional.of(new Entry(r.getDouble("latitude"), r.getDouble("longitude"), r.getString("source"),
                r.getString("provider"), r.getOffsetDateTime("resolved_at")));
    }

    @Override
    public void put(String addressKey, String country, Entry e) {
        query(pool.get(), """
                INSERT INTO miot_trips.geocode_cache (address_key, country, latitude, longitude, source, provider)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (address_key, country) DO UPDATE SET latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude, source = EXCLUDED.source, provider = EXCLUDED.provider,
                    resolved_at = now()""",
                Tuple.of(addressKey, country, e.lat(), e.lon(), e.source(), e.provider()));
    }
}
