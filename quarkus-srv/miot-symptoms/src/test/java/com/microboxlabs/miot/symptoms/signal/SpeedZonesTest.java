package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class SpeedZonesTest {

    private static final String SQUARE = """
            {"type":"Polygon","coordinates":[[[-70.70,-33.50],[-70.60,-33.50],[-70.60,-33.40],[-70.70,-33.40],[-70.70,-33.50]]]}
            """;

    private static SpeedZones zones(SpeedZones.Zone... z) {
        SpeedZones zones = new SpeedZones();
        zones.load(List.of(z));
        return zones;
    }

    @Test
    void aZoneWithOneLimitAppliesInsideItForItsOrganizationOnly() {
        SpeedZones zones = zones(SpeedZones.zone("org-1", 7, new SpeedZones.Limits(40, null, null, null, null), SQUARE));

        assertEquals(new SpeedZones.Limit(40, 7), zones.at("org-1", -70.65, -33.45, 0.0, null));
        assertNull(zones.at("org-2", -70.65, -33.45, 0.0, null));
        assertNull(zones.at("org-1", -70.55, -33.45, 0.0, null), "outside");
        assertEquals(30, zones(SpeedZones.zone("org-1", 7, new SpeedZones.Limits(null, 30, null, null, null), SQUARE))
                .at("org-1", -70.65, -33.45, 0.0, null).maxspeed(), "only a backward limit");
    }

    @Test
    void theBearingOfTravelPicksForwardOrBackward() {
        SpeedZones north = zones(SpeedZones.zone("org-1", 1, new SpeedZones.Limits(60, 40, 270, 90, null), SQUARE));

        assertEquals(60, north.at("org-1", -70.65, -33.45, null, 10).maxspeed());
        assertEquals(60, north.at("org-1", -70.65, -33.45, null, 300).maxspeed());
        assertEquals(40, north.at("org-1", -70.65, -33.45, null, 180).maxspeed());
        assertNull(north.at("org-1", -70.65, -33.45, null, null), "direction unknown");

        SpeedZones oneWay = zones(SpeedZones.zone("org-1", 1, new SpeedZones.Limits(50, null, 0, 180, null), SQUARE));
        assertNull(oneWay.at("org-1", -70.65, -33.45, null, 200), "no limit going backward");
        assertEquals(50, zones(SpeedZones.zone("org-1", 1, new SpeedZones.Limits(50, 50, 0, 180, null), SQUARE))
                .at("org-1", -70.65, -33.45, null, null).maxspeed(), "same both ways");
    }

    @Test
    void aZoneWithAHeadingAppliesOnlyToVehiclesHeadingThatWay() {
        SpeedZones zones = zones(SpeedZones.zone("org-1", 1, new SpeedZones.Limits(30, null, null, null, 100), SQUARE),
                SpeedZones.zone("org-1", 2, new SpeedZones.Limits(50, null, null, null, null), SQUARE));

        assertEquals(1, zones.at("org-1", -70.65, -33.45, 120.0, null).zoneId(), "same quadrant");
        assertEquals(1, zones.at("org-1", -70.65, -33.45, 20.0, null).zoneId(), "less than 90° apart");
        assertEquals(2, zones.at("org-1", -70.65, -33.45, 280.0, null).zoneId(), "opposite: the next zone");
        assertEquals(2, zones.at("org-1", -70.65, -33.45, null, null).zoneId(), "unknown heading");
        assertEquals(2, zones.at("org-1", -70.65, -33.45, Double.NaN, null).zoneId(), "invalid heading");
    }

    @Test
    void overlappingZonesUseTheLowestId() {
        SpeedZones zones = zones(SpeedZones.zone("org-1", 9, new SpeedZones.Limits(80, null, null, null, null), SQUARE),
                SpeedZones.zone("org-1", 3, new SpeedZones.Limits(30, null, null, null, null), SQUARE));
        assertEquals(new SpeedZones.Limit(30, 3), zones.at("org-1", -70.65, -33.45, null, null));
    }

    @Test
    void nothingBeforeALoadAndNoZoneForAnotherShape() {
        assertNull(new SpeedZones().at("org-1", -70.65, -33.45, null, null));
        assertNull(SpeedZones.zone("org-1", 1, new SpeedZones.Limits(30, null, null, null, null), "{\"type\":\"Point\",\"coordinates\":[0,0]}"));
    }

    @Test
    void bearingsAreThePlanarAzimuthFromThePreviousPosition() {
        Bearings b = new Bearings(Duration.ofMinutes(10));
        Instant t = Instant.parse("2026-11-01T00:00:00Z");

        assertNull(b.next("A", t, -70.65, -33.45));
        assertEquals(0, b.next("A", t.plusSeconds(30), -70.65, -33.44));
        assertEquals(90, b.next("A", t.plusSeconds(60), -70.64, -33.44));
        assertEquals(90, b.next("A", t.plusSeconds(90), -70.64, -33.44), "same position keeps the last bearing");
        assertEquals(225, b.next("A", t.plusSeconds(120), -70.65, -33.45));
        assertNull(b.next("A", t.plusSeconds(100), -70.66, -33.45), "an older frame");
        assertNull(b.next("A", t.plusSeconds(3600), -70.66, -33.45), "after a long silence");

        b.prune(t.plusSeconds(3600 + 601));
        assertEquals(0, b.size());
    }
}
