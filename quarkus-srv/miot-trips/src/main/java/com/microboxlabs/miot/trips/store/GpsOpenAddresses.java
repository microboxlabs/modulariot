package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * {@link InternalAddresses} on the GPS database's {@code openaddresses} table: Chile only, from the INE, with
 * commune, street and number in upper case. Read-only sessions; the {@code (city, street, number)} index serves
 * the lookup.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class GpsOpenAddresses implements InternalAddresses {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final GpsDatabase gps;

    @Inject
    GpsOpenAddresses(GpsDatabase gps) {
        this.gps = gps;
    }

    @Override
    public boolean supports(String country) {
        return "CL".equals(country) && gps.configured();
    }

    @Override
    public Optional<Point> find(String country, List<String> communes, List<String> streets, String number) {
        if (!supports(country) || communes.isEmpty() || streets.isEmpty() || number == null) {
            return Optional.empty();
        }
        var rows = gps.readPool().preparedQuery("""
                SELECT ST_X(wkb_geometry) AS lon, ST_Y(wkb_geometry) AS lat
                  FROM openaddresses
                 WHERE city = ANY($1::text[]) AND street = ANY($2::text[]) AND number = $3::text
                   AND wkb_geometry IS NOT NULL
                 ORDER BY ogc_fid
                 LIMIT 1""")
                .execute(Tuple.of(communes.toArray(String[]::new), streets.toArray(String[]::new), number))
                .await().atMost(TIMEOUT);
        if (!rows.iterator().hasNext()) {
            return Optional.empty();
        }
        Row r = rows.iterator().next();
        return Optional.of(new Point(r.getDouble("lon"), r.getDouble("lat")));
    }
}
