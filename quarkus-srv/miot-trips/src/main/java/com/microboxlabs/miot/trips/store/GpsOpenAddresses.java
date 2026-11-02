package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * {@link InternalAddresses} on the GPS database's {@code openaddresses} table: Chile only, from the INE, with
 * commune, street and number in upper case. Read-only sessions; the {@code (city, street, number)} index serves a
 * lookup within a commune, and a lookup across the country scans the table.
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
    public List<Candidate> numbered(String country, List<String> communes, String number, int limit) {
        if (!supports(country) || number == null) {
            return List.of();
        }
        boolean anywhere = communes.isEmpty();
        String sql = """
                SELECT city, street, ST_X(wkb_geometry) AS lon, ST_Y(wkb_geometry) AS lat
                  FROM openaddresses
                 WHERE number = $1::text AND wkb_geometry IS NOT NULL"""
                + (anywhere ? "" : " AND city = ANY($3::text[])")
                + " ORDER BY ogc_fid LIMIT $2";
        Tuple params = Tuple.of(number, limit);
        if (!anywhere) {
            params.addArrayOfString(communes.toArray(String[]::new));
        }
        List<Candidate> out = new ArrayList<>();
        for (Row r : gps.readPool().preparedQuery(sql).execute(params).await().atMost(TIMEOUT)) {
            out.add(new Candidate(r.getString("city"), r.getString("street"),
                    new Point(r.getDouble("lon"), r.getDouble("lat"))));
        }
        return out;
    }
}
