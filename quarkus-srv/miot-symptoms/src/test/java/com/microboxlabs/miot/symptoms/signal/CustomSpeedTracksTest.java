package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CustomSpeedTracksTest {

    private static final String SQUARE = """
            {"type":"Polygon","coordinates":[[[-70.70,-33.50],[-70.60,-33.50],[-70.60,-33.40],[-70.70,-33.40],[-70.70,-33.50]]]}
            """;
    private static final Map<String, CustomSpeedTracks.Rule> RULES = CustomSpeedTracks.rules(
            Map.of("east", "0-180", "north", "270-90", "single", "one-limit"));

    private static SpeedZones loaded(CustomSpeedTracks.Row... rows) {
        SpeedZones zones = new SpeedZones();
        zones.load(java.util.Arrays.stream(rows).map(r -> CustomSpeedTracks.zone("org-1", r, RULES))
                .filter(java.util.Objects::nonNull).toList());
        return zones;
    }

    @Test
    void siteRulesAreARangeOfBearingsOrOneLimit() {
        assertEquals(new CustomSpeedTracks.Forward(270, 90), CustomSpeedTracks.rule("270-90"));
        assertEquals(new CustomSpeedTracks.Forward(0, 180), CustomSpeedTracks.rule(" 0 - 180 "));
        assertEquals(new CustomSpeedTracks.OneLimit(), CustomSpeedTracks.rule("one-limit"));
        assertThrows(IllegalArgumentException.class, () -> CustomSpeedTracks.rule("0-400"));
        assertThrows(IllegalArgumentException.class, () -> CustomSpeedTracks.rule("north"));
        assertTrue(CustomSpeedTracks.rules(Map.of()).isEmpty());
    }

    @Test
    void aRangeSitePicksForwardByTheBearingOfTravel() {
        SpeedZones east = loaded(new CustomSpeedTracks.Row(1, "east", 60, 40, null, SQUARE));
        assertEquals(60, east.at("org-1", -70.65, -33.45, null, 0).maxspeed());
        assertEquals(60, east.at("org-1", -70.65, -33.45, null, 180).maxspeed());
        assertEquals(40, east.at("org-1", -70.65, -33.45, null, 181).maxspeed());
        assertNull(east.at("org-1", -70.65, -33.45, null, null), "no bearing yet");

        SpeedZones north = loaded(new CustomSpeedTracks.Row(2, "north", 50, null, null, SQUARE));
        assertEquals(50, north.at("org-1", -70.65, -33.45, null, 270).maxspeed());
        assertEquals(50, north.at("org-1", -70.65, -33.45, null, 90).maxspeed());
        assertNull(north.at("org-1", -70.65, -33.45, null, 91), "no backward limit");
    }

    @Test
    void aOneLimitSiteUsesBackwardElseForwardAndItsAzimuthFiltersTheHeading() {
        SpeedZones zones = loaded(new CustomSpeedTracks.Row(3, "single", 70, 30, 100, SQUARE),
                new CustomSpeedTracks.Row(4, "single", 45, null, null, SQUARE));
        assertEquals(new SpeedZones.Limit(30, 3), zones.at("org-1", -70.65, -33.45, 120.0, null));
        assertEquals(new SpeedZones.Limit(45, 4), zones.at("org-1", -70.65, -33.45, 280.0, null));
    }

    @Test
    void rowsWithoutARuleALimitOrAPolygonAreNotLoaded() {
        assertNull(CustomSpeedTracks.zone("org-1", new CustomSpeedTracks.Row(5, "other", 40, 40, null, SQUARE), RULES));
        assertNull(CustomSpeedTracks.zone("org-1", new CustomSpeedTracks.Row(6, null, 40, 40, null, SQUARE), RULES));
        assertNull(CustomSpeedTracks.zone("org-1", new CustomSpeedTracks.Row(7, "single", null, null, null, SQUARE), RULES));
        assertNull(CustomSpeedTracks.zone("org-1", new CustomSpeedTracks.Row(8, "east", 40, 40, null, null), RULES));
        assertNull(CustomSpeedTracks.zone("org-1", new CustomSpeedTracks.Row(9, "east", 40, 40, null,
                "{\"type\":\"LineString\",\"coordinates\":[[0,0],[1,1]]}"), RULES));
    }

    @Test
    void siteCodesIgnoreCaseSoTheyCanComeFromEnvironmentVariables() {
        io.smallrye.config.SmallRyeConfig config = new io.smallrye.config.SmallRyeConfigBuilder()
                .withMapping(CustomSpeedTracks.Settings.class)
                .withSources(new io.smallrye.config.EnvConfigSource(Map.of(
                        "MIOT_SYMPTOMS_SPEED_CUSTOM_TRACKS_TENANT", "org-1",
                        "MIOT_SYMPTOMS_SPEED_CUSTOM_TRACKS_TABLE", "speed_tracks",
                        "MIOT_SYMPTOMS_SPEED_CUSTOM_TRACKS_SITES_EAST", "0-180"), 300))
                .build();
        CustomSpeedTracks.Settings settings = config.getConfigMapping(CustomSpeedTracks.Settings.class);
        assertEquals("org-1", settings.tenant().orElseThrow());
        assertEquals("speed_tracks", settings.table().orElseThrow());
        Map<String, CustomSpeedTracks.Rule> rules = CustomSpeedTracks.rules(settings.sites());
        assertEquals(new CustomSpeedTracks.Forward(0, 180), rules.get("east"));
        assertEquals(60, CustomSpeedTracks.zone("org-1", new CustomSpeedTracks.Row(1, "EAST", 60, 40, null, SQUARE),
                rules).forward());
    }

    @Test
    void anUnconfiguredSettingsHasNoTenantTableOrSites() {
        CustomSpeedTracks.Settings settings = new io.smallrye.config.SmallRyeConfigBuilder()
                .withMapping(CustomSpeedTracks.Settings.class).build()
                .getConfigMapping(CustomSpeedTracks.Settings.class);
        assertTrue(settings.tenant().isEmpty());
        assertTrue(settings.table().isEmpty());
        assertTrue(settings.sites().isEmpty());
    }

    @Test
    void theQueryReadsTheConfiguredTableAndRejectsAnythingElse() {
        String sql = CustomSpeedTracks.sql("public.speed_tracks");
        assertTrue(sql.contains("FROM public.speed_tracks WHERE geom IS NOT NULL"));
        for (String column : List.of("id", "client", "speed_forward", "speed_backward", "azimuth_degree",
                "ST_AsGeoJSON(geom) AS shape")) {
            assertTrue(sql.contains(column), column);
        }
        assertThrows(IllegalArgumentException.class, () -> CustomSpeedTracks.sql("t; DROP TABLE x"));
        assertThrows(IllegalArgumentException.class, () -> CustomSpeedTracks.sql("a.b.c"));
    }
}
