package com.microboxlabs.miot.symptoms.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Runs the treatment page's GPS reads against a real database, with minimal copies of the GPS tables and functions.
 * Skipped unless {@code -Dmiot.symptoms.test.pg-url=postgresql://user:password@host:port/db} is set. The tables are
 * created in the database's {@code public} schema, so use a scratch database; the test refuses a database whose
 * {@code public.symptoms} it did not create. Without PostGIS, positions are stored as text.
 *
 * <p>Client {@code org-a} stores its symptoms as {@code stored-a}; the others store them under their own id.
 */
@EnabledIfSystemProperty(named = PgTreatmentReadsTest.URL_PROPERTY, matches = ".+")
class PgTreatmentReadsTest {

    static final String URL_PROPERTY = "miot.symptoms.test.pg-url";
    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String MARKER = "miot-symptoms PgTreatmentReadsTest";

    private static Vertx vertx;
    private static Pool pool;

    private final PgTreatmentReads reads = new PgTreatmentReads(() -> pool);

    @BeforeAll
    static void setUp() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(URL_PROPERTY)))
                .using(vertx).build();
        var existing = pool.query("SELECT to_regclass('public.symptoms') IS NOT NULL AS present, "
                + "obj_description(to_regclass('public.symptoms'), 'pg_class') AS note").execute()
                .await().atMost(WAIT).iterator().next();
        if (existing.getBoolean("present") && !MARKER.equals(existing.getString("note"))) {
            throw new IllegalStateException("public.symptoms exists and was not created by this test");
        }
        dropAll();
        boolean postgis = pool.query("SELECT count(*) > 0 AS p FROM pg_extension WHERE extname = 'postgis'")
                .execute().await().atMost(WAIT).iterator().next().getBoolean("p");
        if (postgis) {
            run("""
                    CREATE FUNCTION public.miot_test_point(x float8, y float8) RETURNS geography LANGUAGE sql
                    AS $$ SELECT ST_SetSRID(ST_MakePoint(x, y), 4326)::geography $$""");
        } else {
            run("CREATE DOMAIN public.geography AS text");
            run("CREATE DOMAIN public.geometry AS text");
            run("""
                    CREATE FUNCTION public.st_x(g public.geometry) RETURNS float8 LANGUAGE sql
                    AS $$ SELECT split_part(g, ' ', 1)::float8 $$""");
            run("""
                    CREATE FUNCTION public.st_y(g public.geometry) RETURNS float8 LANGUAGE sql
                    AS $$ SELECT split_part(g, ' ', 2)::float8 $$""");
            run("""
                    CREATE FUNCTION public.miot_test_point(x float8, y float8) RETURNS public.geography
                    LANGUAGE sql AS $$ SELECT (x || ' ' || y)::public.geography $$""");
        }
        run("CREATE TABLE public.symptoms (id bigint PRIMARY KEY, client_id varchar, trip_id varchar, "
                + "asset_id varchar)");
        run("COMMENT ON TABLE public.symptoms IS '" + MARKER + "'");
        run("CREATE TABLE public.live_trip (trip_id varchar, asset_id varchar, start_time timestamptz, "
                + "end_time timestamptz, PRIMARY KEY (trip_id, asset_id))");
        run("CREATE TABLE public.historical_trip (trip_id varchar, asset_id varchar, start_time timestamptz, "
                + "end_time timestamptz, closed_timestamp timestamptz, PRIMARY KEY (trip_id, asset_id))");
        run("CREATE VIEW public.v_trips AS SELECT trip_id, asset_id, start_time FROM public.live_trip UNION ALL SELECT trip_id, asset_id, start_time FROM public.historical_trip");
        run("CREATE TABLE public.asset_client_map (asset_id text, shared_client_id text, active boolean, "
                + "valid_from timestamptz, valid_to timestamptz, PRIMARY KEY (asset_id, shared_client_id))");
        run("CREATE TABLE public.asset_data (asset_id varchar, \"timestamp\" timestamptz, speed float8, "
                + "heading float8, location geography)");
        run("CREATE INDEX ON public.asset_data (\"timestamp\", asset_id)");
        run("""
                CREATE FUNCTION public.api_request_symptoms_client_id() RETURNS varchar LANGUAGE sql STABLE AS $$
                    SELECT CASE c WHEN 'org-a' THEN 'stored-a' ELSE c END
                    FROM (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub' AS c) x $$""");
        run("""
                CREATE FUNCTION public.api_modular_treatments_geofences_service(p_trip_id varchar)
                RETURNS jsonb LANGUAGE sql AS $$
                    SELECT jsonb_build_object('status', 200, 'data', jsonb_build_array(jsonb_build_object(
                        'trip_id', p_trip_id, 'client', public.api_request_symptoms_client_id()))) $$""");
        run("""
                CREATE FUNCTION public.api_modular_treatments_info_general(p_client_id varchar, p_symptom_id int,
                        p_dev_env int) RETURNS jsonb LANGUAGE sql AS $$
                    SELECT jsonb_build_object('status', 200, 'data', jsonb_build_object(
                        'id', p_symptom_id, 'client', public.api_request_symptoms_client_id())) $$""");
        run("""
                CREATE FUNCTION public.api_modular_treatment_symptoms_signals_map(p_client_id varchar,
                        p_symptom_id bigint) RETURNS jsonb LANGUAGE sql AS $$
                    SELECT jsonb_build_object('status', 200, 'data', jsonb_build_object(
                        'type', 'FeatureCollection', 'features', null)) $$""");

        run("""
                INSERT INTO public.symptoms VALUES
                    (101, 'stored-a', 'T1', 'AB12'),
                    (102, 'org-b', 'T9', 'ZZ99')""");
        run("""
                INSERT INTO public.historical_trip VALUES
                    ('T1', 'AB12', now() - interval '2 days', now() - interval '1 day', null),
                    ('T2', 'CD34', now() - interval '30 days', now() - interval '29 days', null),
                    ('T3', 'EF56', now() - interval '3 days', null, now() - interval '2 days'),
                    ('T5', 'GH78', now() - interval '3 days', now() - interval '2 days', null),
                    ('T6', 'IJ90', now() - interval '3 days', now() - interval '2 days', null),
                    ('T7', 'KL12', now() - interval '20 days', now() - interval '1 day', null)""");
        run("INSERT INTO public.live_trip VALUES ('T8', 'EF56', now() - interval '1 hour', null)");
        run("""
                INSERT INTO public.asset_client_map VALUES
                    ('AB12', 'org-x', true, now() - interval '1 hour', null),
                    ('CD34', 'org-b', true, now() - interval '10 days', null),
                    ('CD34', 'org-c', false, now() - interval '60 days', now() - interval '31 days'),
                    ('CD34', 'org-d', false, now() - interval '40 days', now() - interval '25 days'),
                    ('EF56', 'org-b', true, null, null),
                    ('GH78', 'stored-a', true, now() - interval '10 days', null),
                    ('IJ90', 'org-b', true, null, null),
                    ('KL12', 'org-b', true, null, null),
                    ('MN34', 'org-b', true, now() - interval '1 hour', null),
                    ('OP56', 'org-c', true, null, now() - interval '30 minutes'),
                    ('OP56', 'org-b', true, now() - interval '30 minutes', null)""");
        run("""
                INSERT INTO public.asset_data
                SELECT 'AB12', now() - interval '2 days' + i * interval '1 hour', 50, 90, public.miot_test_point(-70, -33)
                FROM generate_series(1, 5) i""");
        run("""
                INSERT INTO public.asset_data
                SELECT 'IJ90', now() - interval '3 days' + i * interval '1 minute', i, 0, public.miot_test_point(-70, -33)
                FROM generate_series(1, 25) i""");
        run("""
                INSERT INTO public.asset_data VALUES
                    ('KL12', now() - interval '19 days', 1, 0, public.miot_test_point(-70, -33)),
                    ('KL12', now() - interval '10 days', 2, 0, public.miot_test_point(-70, -33))""");
        run("""
                INSERT INTO public.asset_data VALUES
                    ('MN34', now() - interval '1 hour' - interval '2 seconds', 1, 0, public.miot_test_point(-70, -33)),
                    ('OP56', now() - interval '40 minutes', 1, 0, public.miot_test_point(-70, -33)),
                    ('OP56', now() - interval '20 minutes', 2, 0, public.miot_test_point(-70, -33))""");
    }

    @AfterAll
    static void tearDown() {
        dropAll();
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private static void dropAll() {
        run("DROP VIEW IF EXISTS public.v_trips");
        run("DROP FUNCTION IF EXISTS public.api_modular_treatments_geofences_service(varchar)");
        for (String table : new String[] {"symptoms", "live_trip", "historical_trip", "asset_client_map",
                "asset_data"}) {
            run("DROP TABLE IF EXISTS public." + table);
        }
        run("DROP FUNCTION IF EXISTS public.api_request_symptoms_client_id()");
        run("DROP FUNCTION IF EXISTS public.api_modular_treatments_info_general(varchar, int, int)");
        run("DROP FUNCTION IF EXISTS public.api_modular_treatment_symptoms_signals_map(varchar, bigint)");
        run("DROP FUNCTION IF EXISTS public.miot_test_point(float8, float8)");
        boolean postgis = pool.query("SELECT count(*) > 0 AS p FROM pg_extension WHERE extname = 'postgis'")
                .execute().await().atMost(WAIT).iterator().next().getBoolean("p");
        if (!postgis) {
            run("DROP FUNCTION IF EXISTS public.st_x(public.geometry)");
            run("DROP FUNCTION IF EXISTS public.st_y(public.geometry)");
            run("DROP DOMAIN IF EXISTS public.geography");
            run("DROP DOMAIN IF EXISTS public.geometry");
        }
    }

    private static void run(String sql) {
        pool.query(sql).execute().await().atMost(WAIT);
    }

    private static <T> T await(io.smallrye.mutiny.Uni<T> uni) {
        return uni.await().atMost(WAIT);
    }

    private Optional<JsonNode> positions(String trip, String asset, String client) {
        return await(reads.tripPositions(trip, asset, client, ControlTowerTreatmentService.MAX_POSITIONS));
    }

    @Test
    void legacyGeofencesRequireTheTripAssetsTenant() {
        var own = reads.tripGeofences("T5", "org-a").await().atMost(WAIT).orElseThrow();
        assertEquals("T5", own.path("data").get(0).path("trip_id").asText());
        assertTrue(reads.tripGeofences("T5", "org-b").await().atMost(WAIT).isEmpty());
        assertTrue(reads.tripGeofences("T1", "org-a").await().atMost(WAIT).isPresent());
    }

    @Test
    void anAliasedClientReachesItsSymptomUnderTheStoredId() {
        JsonNode answer = await(reads.treatment("org-a", 101)).orElseThrow();
        assertEquals(101, answer.path("data").path("id").asInt());
        assertEquals("stored-a", answer.path("data").path("client").asText());
        assertTrue(await(reads.signals("org-a", 101)).isPresent());
        long direct = pool.query("SELECT count(*) AS n FROM public.symptoms WHERE id = 101 AND client_id = 'org-a'")
                .execute().await().atMost(WAIT).iterator().next().getLong("n");
        assertEquals(0, direct, "a direct comparison with the organization's id misses the symptom");
    }

    @Test
    void anUnrelatedClientGetsNoSymptom() {
        assertTrue(await(reads.treatment("org-x", 101)).isEmpty());
        assertTrue(await(reads.signals("org-x", 101)).isEmpty());
        assertTrue(await(reads.treatment("org-b", 101)).isEmpty());
        assertTrue(await(reads.treatment("org-a", 102)).isEmpty());
        assertTrue(await(reads.treatment("org-b", 102)).isPresent());
        assertTrue(await(reads.treatment("org-b", 999)).isEmpty());
    }

    @Test
    void aSymptomOnTheTripGivesItsPositions() {
        JsonNode points = positions("T1", "AB12", "org-a").orElseThrow();
        assertEquals(5, points.size());
        assertEquals(-70, points.get(0).path("longitude").asDouble(), 1e-9);
        assertEquals(-33, points.get(0).path("latitude").asDouble(), 1e-9);
        assertTrue(points.get(0).path("timestamp").asText().compareTo(points.get(4).path("timestamp").asText()) < 0);
    }

    @Test
    void aClientMappedToTheAssetOnlyAfterTheTripGetsNothing() {
        assertTrue(positions("T1", "AB12", "org-x").isEmpty(), "mapped an hour ago, the trip is two days old");
        assertTrue(positions("T2", "CD34", "org-b").isEmpty(), "mapped ten days ago, the trip is thirty days old");
        assertTrue(positions("T1", "AB12", "org-b").isEmpty(), "never mapped, no symptom");
    }

    @Test
    void aMappingThatEndedBeforeTheTripGivesNothing() {
        assertTrue(positions("T2", "CD34", "org-c").isEmpty());
    }

    @Test
    void aMappingValidWhenTheTripStartedGivesItsPositions() {
        assertTrue(positions("T2", "CD34", "org-d").isPresent(), "ended later, still valid at the start");
        assertTrue(positions("T3", "EF56", "org-b").isPresent(), "open-ended mapping");
        assertTrue(positions("T8", "EF56", "org-b").isPresent(), "live trip");
        assertTrue(positions("T5", "GH78", "org-a").isPresent(), "mapped under the stored id");
        assertTrue(positions("T3", "EF56", "org-x").isEmpty());
        assertTrue(positions("T3", "AB12", "org-b").isEmpty(), "the trip is not on that asset");
    }

    @Test
    void aLongTripIsSampledEvenlyKeepingTheEnds() {
        JsonNode all = await(reads.tripPositions("T6", "IJ90", "org-b", 100)).orElseThrow();
        assertEquals(25, all.size());
        JsonNode sampled = await(reads.tripPositions("T6", "IJ90", "org-b", 10)).orElseThrow();
        assertTrue(sampled.size() <= 10 && sampled.size() >= 8, "size " + sampled.size());
        assertEquals(1, sampled.get(0).path("speed").asInt());
        assertEquals(25, sampled.get(sampled.size() - 1).path("speed").asInt());
    }

    @Test
    void theTripWindowIsAtMostSevenDays() {
        JsonNode points = positions("T7", "KL12", "org-b").orElseThrow();
        assertEquals(1, points.size());
        assertEquals(1, points.get(0).path("speed").asInt());
    }

    @Test
    void anAssetsPositionsInARangeAreSampledOldestFirst() {
        Instant now = Instant.now();
        JsonNode window = await(reads.assetPositions("IJ90", now.minus(Duration.ofDays(4)), now, "org-b", 10));
        assertTrue(window.size() <= 10 && window.size() >= 8, "size " + window.size());
        assertEquals(1, window.get(0).path("speed").asInt());
        assertEquals(25, window.get(window.size() - 1).path("speed").asInt());
        assertEquals("T6", window.get(0).path("tripid").asText(), "sent during trip T6");
        assertEquals(0, await(reads.assetPositions("IJ90", now.minus(Duration.ofDays(1)), now, "org-b", 10)).size());
        assertEquals(0, await(reads.assetPositions("IJ90", now.minus(Duration.ofDays(4)), now, "org-x", 10)).size(),
                "the asset is not mapped to org-x");
    }

    @Test
    void aNewVehiclesFirstSignalBeforeItsMappingCounts() {
        Instant now = Instant.now();
        JsonNode first = await(reads.assetPositions("MN34", now.minus(Duration.ofHours(2)), now, "org-b", 10));
        assertEquals(1, first.size(), "sent two seconds before the mapping was written");
    }

    @Test
    void aSignalWhileAnotherClientHadTheVehicleDoesNotCount() {
        Instant now = Instant.now();
        JsonNode points = await(reads.assetPositions("OP56", now.minus(Duration.ofHours(1)), now, "org-b", 10));
        assertEquals(1, points.size());
        assertEquals(2, points.get(0).path("speed").asInt());
        assertTrue(points.get(0).path("tripid").isNull(), "no trip");
    }
}
