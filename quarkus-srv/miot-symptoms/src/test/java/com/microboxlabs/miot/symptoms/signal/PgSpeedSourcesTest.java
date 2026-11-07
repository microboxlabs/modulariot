package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.EnvelopedMessage;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.pgclient.PgException;
import java.time.Duration;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
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
                    azimuth_degree integer, client_id text NOT NULL, forward_from integer, forward_to integer,
                    single_limit boolean NOT NULL DEFAULT false);
                INSERT INTO speed_tracks (client, geom, "order", speed_forward, speed_backward, azimuth_degree,
                        client_id, forward_from, forward_to, single_limit) VALUES
                    ('north', 'SRID=4326;POLYGON((-70.70 -33.50,-70.60 -33.50,-70.60 -33.40,-70.70 -33.40,-70.70 -33.50))',
                     3, 60, 40, NULL, 'org-1', 270, 90, false),
                    ('single', 'SRID=4326;POLYGON((-71.70 -34.50,-71.60 -34.50,-71.60 -34.40,-71.70 -34.40,-71.70 -34.50))',
                     NULL, 70, 30, NULL, 'org-2', NULL, NULL, true),
                    ('by-order', 'SRID=4326;POLYGON((-70.70 -33.50,-70.60 -33.50,-70.60 -33.40,-70.70 -33.40,-70.70 -33.50))',
                     2, 20, 20, NULL, 'org-2', NULL, NULL, false);
                CREATE TEMP TABLE legacy_speed_tracks (id serial PRIMARY KEY, client text, name varchar,
                    geom geometry(Geometry,4326), "order" integer, speed_forward integer, speed_backward integer,
                    azimuth_degree integer);
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
    void customTracksBecomeTheirOrganizationsZones() {
        List<SpeedZones.Zone> zones = SignalStream.customZones(
                pool.query(CustomSpeedTracks.sql("speed_tracks")).execute().await().atMost(WAIT));
        SpeedZones speed = new SpeedZones();
        speed.load(zones);
        assertEquals(2, speed.size(), "the row without a range or single_limit is not loaded");
        assertEquals(60, speed.at("org-1", -70.65, -33.45, null, 0).maxspeed());
        assertEquals(40, speed.at("org-1", -70.65, -33.45, null, 180).maxspeed());
        assertNull(speed.at("org-2", -70.65, -33.45, null, 0));
        assertEquals(30, speed.at("org-2", -71.65, -34.45, null, null).maxspeed());
    }

    @Test
    void aTableWithoutTheNewColumnsFailsAsAnUndefinedColumn() {
        var read = pool.query(CustomSpeedTracks.sql("legacy_speed_tracks")).execute().await();
        PgException failure = assertThrows(PgException.class, () -> read.atMost(WAIT));
        assertEquals(CustomSpeedTracks.UNDEFINED_COLUMN, failure.getSqlState());
        assertTrue(SignalStream.undefinedColumn(failure));
    }

    @Test
    void aLegacyTableClearsCustomLimitsAndStillBuildsSignals() {
        SpeedZones zones = new SpeedZones();
        zones.load(SignalStream.customZones(
                pool.query(CustomSpeedTracks.sql("speed_tracks")).execute().await().atMost(WAIT)));
        assertEquals(2, zones.size());

        zones.load(SignalStream.loadSpeedZones(pool, "legacy_speed_tracks").await().atMost(WAIT));

        assertEquals(0, zones.size());
        ReferenceCache refs = new ReferenceCache();
        refs.load(List.of(), List.of());
        RoadNetwork roads = RoadNetwork.of(List.of(RoadNetworkTest.way(42, "primary", 70, 60, 80, -33.45)));
        roads.ensure(-70.65, -33.45).await().atMost(WAIT);
        SignalBuilder builder = new SignalBuilder(refs, ZoneId.of("UTC"), new Zones(), roads, zones,
                new Bearings(Duration.ofMinutes(10)));
        GpsSignal signal = builder.build(EnvelopedMessage.fromJson("""
                {"clientId":"org-1@clients","timestamp":"2026-10-21T12:00:01Z",
                 "payload":{"asset_id":"vehicle-1","timestamp":"2026-10-21T12:00:00Z",
                            "gps":{"latitude":-33.45,"longitude":-70.65,"speed":50}}}
                """)).orElseThrow();
        assertEquals(new GpsSignal.Road(60.0, null, 42L, "primary", null), signal.roads().get("org-1"));
    }

    @Test
    void otherReadFailuresKeepThePreviousZones() {
        assertNull(SignalStream.loadSpeedZones(pool, "missing_speed_tracks").await().atMost(WAIT));
    }
}
