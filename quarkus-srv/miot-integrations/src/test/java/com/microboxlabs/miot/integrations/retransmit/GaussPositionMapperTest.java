package com.microboxlabs.miot.integrations.retransmit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.retransmit.GaussPositionMapper.Defaults;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Test;

class GaussPositionMapperTest {

    private final Defaults defaults = Defaults.fromConfig(";MEL;", "GPS", "streamhub", "streamhub-miot");

    @Test
    void mapsFullModeFromRetransmitPayload() {
        JsonObject payload = new JsonObject()
                .put("spec", "miot.gps.retransmit@1")
                .put("mode", "full")
                .put("config_id", "mel-gauss")
                .put("asset_id", "VKFR64")
                .put("patent", "VKFR64")
                .put("timestamp", "2026-07-10T18:56:18+00:00")
                .put(
                        "gps",
                        new JsonObject()
                                .put("latitude", -24.339208)
                                .put("longitude", -69.060755)
                                .put("altitude", 3189)
                                .put("speed", 12.5)
                                .put("heading", 159))
                .put(
                        "telecom",
                        new JsonObject()
                                .put("gps_provider", "QuecLink")
                                .put("iccid", "8956012345678901234"));

        JsonObject gauss = GaussPositionMapper.toGaussPosition(payload, defaults);

        assertEquals("2026-07-10 18:56:18", gauss.getString("start"));
        assertEquals("VKFR64", gauss.getString("vehicleCode"));
        assertEquals("VKFR64", gauss.getString("vehiclePlate"));
        assertEquals(-24.339208, gauss.getDouble("latitude"), 1e-9);
        assertEquals(-69.060755, gauss.getDouble("longitude"), 1e-9);
        assertEquals(3189.0, gauss.getDouble("altitude"), 1e-9);
        assertEquals(12.5, gauss.getDouble("speed"), 1e-9);
        assertEquals(159, gauss.getInteger("headingAngle"));
        assertEquals(";MEL;", gauss.getString("tags"));
        assertEquals("GPS", gauss.getString("deviceType"));
        assertEquals("8956012345678901234", gauss.getString("deviceId"));
        assertEquals("QuecLink", gauss.getString("eventProvider"));
        assertEquals("streamhub-miot", gauss.getString("deviceModel"));
        assertEquals(1, gauss.getInteger("ignition"));
        assertNull(gauss.getValue("driverCode"));
        assertNull(gauss.getValue("ibuttonCode"));
        assertEquals(0.0, gauss.getDouble("accelerometerX"), 1e-9);
        assertEquals(9.81, gauss.getDouble("accelerometerZ"), 1e-9);
    }

    @Test
    void mapsPrivacyModeWithZerosAndOffIgnition() {
        JsonObject payload = new JsonObject()
                .put("mode", "privacy")
                .put("asset_id", "VHTC24")
                .put("timestamp", "2026-07-10T18:54:38+00:00")
                .put(
                        "gps",
                        new JsonObject()
                                .put("latitude", -33.45)
                                .put("longitude", -70.66)
                                .put("fixed", true)
                                .put("label", "privacy-pin"));

        JsonObject gauss = GaussPositionMapper.toGaussPosition(payload, defaults);
        assertEquals(0.0, gauss.getDouble("speed"), 1e-9);
        assertEquals(0, gauss.getInteger("headingAngle"));
        assertEquals(0, gauss.getInteger("ignition"));
        assertEquals("streamhub-VHTC24", gauss.getString("deviceId"));
        assertEquals("streamhub", gauss.getString("eventProvider"));
    }

    @Test
    void tenantProviderDriverAndAccelerationWin() {
        JsonObject payload = new JsonObject()
                .put("mode", "full")
                .put("asset_id", "ABCD12")
                .put("patent", "ABCD12")
                .put("ingest_client_id", "c1")
                .put("timestamp", "2026-11-17T13:00:00Z")
                .put("gps", new JsonObject().put("latitude", -24.3).put("longitude", -69.1))
                .put("telecom", new JsonObject().put("gps_provider", "QuecLink"))
                .put("driver", new JsonObject().put("driver_id", "15343634").put("id_button", "0000010A0B0C"))
                .put("acceleration", new JsonObject().put("x_axis", 0.027).put("y_axis", -0.002).put("z_axis", 0.061));

        JsonObject gauss = GaussPositionMapper.toGaussPosition(payload, defaults, "acme-gps");

        assertEquals("acme-gps", gauss.getString("eventProvider"));
        assertEquals("acme-gps-ABCD12", gauss.getString("deviceId"));
        assertEquals("15343634", gauss.getString("driverCode"));
        assertEquals("0000010A0B0C", gauss.getString("ibuttonCode"));
        assertEquals(0.027, gauss.getDouble("accelerometerX"), 1e-9);
        assertEquals(-0.002, gauss.getDouble("accelerometerY"), 1e-9);
        assertEquals(0.061, gauss.getDouble("accelerometerZ"), 1e-9);
    }

    @Test
    void unknownProviderKeepsDefaults() {
        JsonObject payload = new JsonObject()
                .put("asset_id", "ABCD12")
                .put("gps", new JsonObject().put("latitude", 1.0).put("longitude", 2.0))
                .put("driver", new JsonObject().put("id_button", " "));

        JsonObject gauss = GaussPositionMapper.toGaussPosition(payload, defaults, null);

        assertEquals("streamhub", gauss.getString("eventProvider"));
        assertEquals("streamhub-ABCD12", gauss.getString("deviceId"));
        assertNull(gauss.getValue("ibuttonCode"));
        assertNull(gauss.getValue("driverCode"));
        assertEquals(9.81, gauss.getDouble("accelerometerZ"), 1e-9);
    }

    @Test
    void bodyIsJsonArray() {
        JsonObject payload = new JsonObject()
                .put("asset_id", "ABC12")
                .put("timestamp", "2026-02-24T13:45:10Z")
                .put("gps", new JsonObject().put("latitude", 1.0).put("longitude", 2.0));
        JsonArray body = GaussPositionMapper.toGaussBody(payload, defaults);
        assertEquals(1, body.size());
        assertEquals("ABC12", body.getJsonObject(0).getString("vehicleCode"));
    }

    @Test
    void normalizeTagsAddsSemicolons() {
        assertEquals(";MEL;", GaussPositionMapper.normalizeTags("MEL"));
        assertEquals(";MEL;ZALDIVAR;", GaussPositionMapper.normalizeTags(";MEL;ZALDIVAR"));
        assertEquals(";MEL;", GaussPositionMapper.normalizeTags(null));
    }

    @Test
    void formatStartAcceptsIso() {
        assertEquals("2026-02-24 13:45:10", GaussPositionMapper.formatStart("2026-02-24T13:45:10Z"));
        assertTrue(GaussPositionMapper.formatStart(null).matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}"));
    }

    @Test
    void headingWraps() {
        assertEquals(0, GaussPositionMapper.normalizeHeading(360));
        assertEquals(32, GaussPositionMapper.normalizeHeading(32.4));
        assertFalse(GaussPositionMapper.normalizeHeading(-1) < 0);
    }
}
