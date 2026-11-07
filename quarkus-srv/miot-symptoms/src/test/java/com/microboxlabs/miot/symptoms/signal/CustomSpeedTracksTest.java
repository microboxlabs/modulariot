package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.pgclient.PgException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CustomSpeedTracksTest {

    private static final String SQUARE = """
            {"type":"Polygon","coordinates":[[[-70.70,-33.50],[-70.60,-33.50],[-70.60,-33.40],[-70.70,-33.40],[-70.70,-33.50]]]}
            """;

    private static CustomSpeedTracks.Row range(int id, String org, Integer fwd, Integer back, int from, int to) {
        return new CustomSpeedTracks.Row(id, org, fwd, back, null, from, to, false, SQUARE);
    }

    private static CustomSpeedTracks.Row single(int id, Integer fwd, Integer back, Integer azimuth) {
        return new CustomSpeedTracks.Row(id, "org-1", fwd, back, azimuth, null, null, true, SQUARE);
    }

    private static SpeedZones loaded(CustomSpeedTracks.Row... rows) {
        SpeedZones zones = new SpeedZones();
        zones.load(java.util.Arrays.stream(rows).map(CustomSpeedTracks::zone)
                .filter(java.util.Objects::nonNull).toList());
        return zones;
    }

    @Test
    void aRangeRowPicksForwardByTheBearingOfTravel() {
        SpeedZones east = loaded(range(1, "org-1", 60, 40, 0, 180));
        assertEquals(60, east.at("org-1", -70.65, -33.45, null, 0).maxspeed());
        assertEquals(60, east.at("org-1", -70.65, -33.45, null, 180).maxspeed());
        assertEquals(40, east.at("org-1", -70.65, -33.45, null, 181).maxspeed());
        assertNull(east.at("org-1", -70.65, -33.45, null, null), "no bearing yet");

        SpeedZones north = loaded(range(2, "org-1", 50, null, 270, 90));
        assertEquals(50, north.at("org-1", -70.65, -33.45, null, 270).maxspeed());
        assertEquals(50, north.at("org-1", -70.65, -33.45, null, 359).maxspeed());
        assertEquals(50, north.at("org-1", -70.65, -33.45, null, 0).maxspeed());
        assertEquals(50, north.at("org-1", -70.65, -33.45, null, 90).maxspeed());
        assertNull(north.at("org-1", -70.65, -33.45, null, 91), "no backward limit");
    }

    @Test
    void rangesAcceptThePreviousSettingsInclusive360Endpoint() {
        Integer nearNorth = Bearings.azimuth(0, 0, -0.001, 1);
        assertEquals(360, nearNorth, "a nearly northward movement can round to 360");
        SpeedZones all = loaded(range(1, "org-1", 60, 40, 0, 360));
        assertEquals(60, all.at("org-1", -70.65, -33.45, null, 359).maxspeed());
        assertEquals(60, all.at("org-1", -70.65, -33.45, null, nearNorth).maxspeed());

        SpeedZones north = loaded(range(2, "org-1", 60, 40, 270, 360));
        assertEquals(60, north.at("org-1", -70.65, -33.45, null, 360).maxspeed());
        assertEquals(40, north.at("org-1", -70.65, -33.45, null, 0).maxspeed());
    }

    @Test
    void aSingleLimitRowUsesBackwardElseForwardAndItsAzimuthFiltersTheHeading() {
        SpeedZones zones = loaded(single(3, 70, 30, 100), single(4, 45, null, null));
        assertEquals(new SpeedZones.Limit(30, 3), zones.at("org-1", -70.65, -33.45, 120.0, null));
        assertEquals(new SpeedZones.Limit(45, 4), zones.at("org-1", -70.65, -33.45, 280.0, null));
    }

    @Test
    void singleLimitWinsOverARange() {
        SpeedZones zones = loaded(new CustomSpeedTracks.Row(5, "org-1", 70, 30, null, 0, 180, true, SQUARE));
        assertEquals(30, zones.at("org-1", -70.65, -33.45, null, 10).maxspeed());
    }

    @Test
    void zonesAreGroupedByTheirOrganization() {
        SpeedZones zones = loaded(range(1, "org-1", 60, 60, 0, 180), range(2, "org-2", 30, 30, 0, 180));
        assertEquals(new SpeedZones.Limit(60, 1), zones.at("org-1", -70.65, -33.45, null, 10));
        assertEquals(new SpeedZones.Limit(30, 2), zones.at("org-2", -70.65, -33.45, null, 10));
        assertNull(zones.at("org-3", -70.65, -33.45, null, 10));
    }

    @Test
    void rowsWithoutAnOrganizationARuleALimitOrAPolygonAreNotLoaded() {
        assertNull(CustomSpeedTracks.zone(new CustomSpeedTracks.Row(5, "org-1", 40, 40, null, null, null, false,
                SQUARE)), "neither a range nor single_limit");
        assertNull(CustomSpeedTracks.zone(new CustomSpeedTracks.Row(6, "org-1", 40, 40, null, 0, null, false,
                SQUARE)), "half a range");
        assertNull(CustomSpeedTracks.zone(range(7, "org-1", 40, 40, 0, 361)), "bearing out of 0-360");
        assertNull(CustomSpeedTracks.zone(range(7, "org-1", 40, 40, -1, 90)), "negative bearing");
        assertNull(CustomSpeedTracks.zone(range(8, null, 40, 40, 0, 180)));
        assertNull(CustomSpeedTracks.zone(range(9, " ", 40, 40, 0, 180)));
        assertNull(CustomSpeedTracks.zone(single(10, null, null, null)));
        assertNull(CustomSpeedTracks.zone(new CustomSpeedTracks.Row(11, "org-1", 40, 40, null, 0, 180, false, null)));
        assertNull(CustomSpeedTracks.zone(new CustomSpeedTracks.Row(12, "org-1", 40, 40, null, 0, 180, false,
                "{\"type\":\"LineString\",\"coordinates\":[[0,0],[1,1]]}")));
    }

    @Test
    void theTableIsTheOnlySettingAndComesFromEnvironmentVariables() {
        CustomSpeedTracks.Settings settings = new io.smallrye.config.SmallRyeConfigBuilder()
                .withMapping(CustomSpeedTracks.Settings.class)
                .withSources(new io.smallrye.config.EnvConfigSource(Map.of(
                        "MIOT_SYMPTOMS_SPEED_CUSTOM_TRACKS_TABLE", "speed_tracks"), 300))
                .build().getConfigMapping(CustomSpeedTracks.Settings.class);
        assertEquals("speed_tracks", settings.table().orElseThrow());

        CustomSpeedTracks.Settings none = new io.smallrye.config.SmallRyeConfigBuilder()
                .withMapping(CustomSpeedTracks.Settings.class).build()
                .getConfigMapping(CustomSpeedTracks.Settings.class);
        assertTrue(none.table().isEmpty());
    }

    @Test
    void theQueryReadsTheOrganizationAndRuleColumnsOfTheConfiguredTable() {
        String sql = CustomSpeedTracks.sql("public.speed_tracks");
        assertTrue(sql.contains("FROM public.speed_tracks WHERE geom IS NOT NULL"));
        for (String column : List.of("id", "client_id", "speed_forward", "speed_backward", "azimuth_degree",
                "forward_from", "forward_to", "single_limit", "ST_AsGeoJSON(geom) AS shape")) {
            assertTrue(sql.contains(column), column);
        }
        assertFalse(sql.matches("(?s).*\\bclient\\b(?!_id).*"), "the site code is not read");
        assertThrows(IllegalArgumentException.class, () -> CustomSpeedTracks.sql("t; DROP TABLE x"));
        assertThrows(IllegalArgumentException.class, () -> CustomSpeedTracks.sql("a.b.c"));
    }

    @Test
    void anUndefinedColumnIsRecognizedThroughWrappers() {
        PgException missing = new PgException("column \"client_id\" does not exist", "ERROR", "42703", null);
        assertTrue(SignalStream.undefinedColumn(missing));
        assertTrue(SignalStream.undefinedColumn(new RuntimeException(missing)));
        assertFalse(SignalStream.undefinedColumn(new PgException("no table", "ERROR", "42P01", null)));
        assertFalse(SignalStream.undefinedColumn(new RuntimeException("timeout")));
    }
}
