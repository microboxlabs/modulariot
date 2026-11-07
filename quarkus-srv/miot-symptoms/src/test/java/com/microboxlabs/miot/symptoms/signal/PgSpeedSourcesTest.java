package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.pgclient.PgException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The signal builder's speed database queries against tables shaped like the legacy ones, created as temporary
 * tables. Skipped unless {@code -Dmiot.symptoms.test.pg-url=...} names a scratch database with PostGIS.
 */
@EnabledIfSystemProperty(named = "miot.symptoms.test.pg-url", matches = ".+")
class PgSpeedSourcesTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static Vertx vertx;
    private static Pool pool;

    private record SpeedSettings(Optional<String> host, int port, Optional<String> name, Optional<String> username,
            Optional<String> password, int maxSize) implements SpeedDatabase.Settings {
    }

    @BeforeAll
    static void open() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().with(new io.vertx.sqlclient.PoolOptions().setMaxSize(1))
                .connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url")))
                .using(vertx).build();
        pool.query("""
                CREATE TEMP TABLE osm_roads_weight (osm_id integer PRIMARY KEY, fclass varchar(28),
                    maxspeed numeric(10,0), spwlte38 numeric(10,0), spwgt38 numeric(10,0), geom geometry(LineString,4326));
                INSERT INTO osm_roads_weight VALUES
                    (1, 'primary', 80, 0, 60, 'SRID=4326;LINESTRING(-70.70 -33.45, -70.60 -33.45)'),
                    (2, 'primary', 50, NULL, NULL, 'SRID=4326;LINESTRING(-71.70 -34.45, -71.60 -34.45)');
                CREATE TEMP TABLE speed_tracks (id serial PRIMARY KEY, client text, name varchar,
                    geom geometry(Geometry,4326), "order" integer, speed_forward integer, speed_backward integer,
                    azimuth_degree integer);
                INSERT INTO speed_tracks (client, geom, "order", speed_forward, speed_backward, azimuth_degree) VALUES
                    ('north', 'SRID=4326;POLYGON((-70.70 -33.50,-70.60 -33.50,-70.60 -33.40,-70.70 -33.40,-70.70 -33.50))',
                     3, 60, 40, NULL),
                    ('unmapped', 'SRID=4326;POLYGON((-70.70 -33.50,-70.60 -33.50,-70.60 -33.40,-70.70 -33.40,-70.70 -33.50))',
                     NULL, 20, 20, NULL);
                """).execute().await().atMost(WAIT);
    }

    @AfterAll
    static void close() {
        if (pool != null) {
            pool.close().await().atMost(WAIT);
        }
        if (vertx != null) {
            vertx.close().await().atMost(WAIT);
        }
    }

    @Test
    void speedDatabaseSessionsRejectWrites() {
        PgConnectOptions options = PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url"));
        SpeedDatabase source = new SpeedDatabase(new SpeedSettings(Optional.of(options.getHost()), options.getPort(),
                Optional.of(options.getDatabase()), Optional.of(options.getUser()),
                Optional.ofNullable(options.getPassword()), 1), vertx);
        try {
            String readOnly = source.pool().query("SHOW transaction_read_only").execute().await().atMost(WAIT)
                    .iterator().next().getString("transaction_read_only");
            assertEquals("on", readOnly);
            var write = source.pool().query("CREATE TABLE public.speed_db_write_must_fail (id integer)")
                    .execute().await();
            PgException failure = assertThrows(PgException.class, () -> write.atMost(WAIT));
            assertEquals("25006", failure.getSqlState());
        } finally {
            source.onStop(null);
        }
    }

    @Test
    void aTileReadsTheWaysWhoseBoxMeetsIt() {
        List<RoadNetwork.Way> ways = new ArrayList<>();
        pool.preparedQuery(SignalStream.ROADS_SQL).execute(Tuple.of(-70.66, -33.46, -70.64, -33.44)).await()
                .atMost(WAIT).forEach(r -> ways.add(new RoadNetwork.Way(r.getLong("osm_id"), r.getString("fclass"),
                        r.getInteger("light"), r.getInteger("heavy"), r.getInteger("maxspeed"),
                        r.getBuffer("wkb").getBytes())));
        assertEquals(1, ways.size());
        RoadNetwork roads = RoadNetwork.of(ways);
        roads.ensure(-70.65, -33.45).await().atMost(WAIT);
        assertEquals(60, roads.at(-70.65, -33.45, GpsSignal.WeightCategory.HEAVY).maxspeed());
        assertEquals(80, roads.at(-70.65, -33.45, GpsSignal.WeightCategory.LIGHT).maxspeed());
    }

    @Test
    void customTracksOfAMappedSiteBecomeTheTenantsZones() {
        Map<String, CustomSpeedTracks.Rule> rules = CustomSpeedTracks.rules(Map.of("north", "270-90"));
        List<SpeedZones.Zone> zones = new ArrayList<>();
        pool.query(CustomSpeedTracks.sql("speed_tracks")).execute().await().atMost(WAIT).forEach(r -> {
            SpeedZones.Zone z = CustomSpeedTracks.zone("org-1", new CustomSpeedTracks.Row(r.getInteger("id"),
                    r.getString("client"), r.getInteger("speed_forward"), r.getInteger("speed_backward"),
                    r.getInteger("azimuth_degree"), r.getString("shape")), rules);
            if (z != null) {
                zones.add(z);
            }
        });
        SpeedZones speed = new SpeedZones();
        speed.load(zones);
        assertEquals(1, speed.size());
        assertEquals(60, speed.at("org-1", -70.65, -33.45, null, 0).maxspeed());
        assertEquals(40, speed.at("org-1", -70.65, -33.45, null, 180).maxspeed());
        assertNull(speed.at("org-2", -70.65, -33.45, null, 0));
    }
}
