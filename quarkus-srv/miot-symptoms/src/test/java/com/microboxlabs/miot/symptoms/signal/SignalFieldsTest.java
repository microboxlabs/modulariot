package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.AssetTrackingData;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.symptoms.catalog.domain.FieldOrigin;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class SignalFieldsTest {

    private static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule());

    /** The gps_signal fields as platform-sources.json declared them; saved symptoms use these paths. */
    private static final String DECLARED = """
            [
              {"path": "signal.trip.active", "label": "En viaje", "type": "bool", "origin": "TRIP", "engineSupported": true},
              {"path": "signal.trip.double_driver", "label": "Dos conductores", "type": "bool", "origin": "TRIP", "engineSupported": true},
              {"path": "signal.vehicle.weight_category", "label": "Categoría de peso", "type": "list", "origin": "VEHICLE", "engineSupported": true,
               "values": [{"value": "HEAVY", "label": "Pesado (más de 3.860 kg o sin dato)"}, {"value": "LIGHT", "label": "Liviano (hasta 3.860 kg)"}]},
              {"path": "signal.vehicle.weight_kg", "label": "Peso máximo", "type": "number", "unit": "kg", "origin": "VEHICLE", "engineSupported": true},
              {"path": "signal.gps.speed_kmh", "label": "Velocidad", "type": "number", "unit": "km/h", "origin": "DEVICE", "engineSupported": true},
              {"path": "signal.gps.engine_on", "label": "Motor encendido", "type": "bool", "origin": "DEVICE", "engineSupported": true},
              {"path": "signal.gps.moving", "label": "En movimiento", "type": "bool", "origin": "CALCULATED", "engineSupported": true},
              {"path": "signal.road.maxspeed_osm", "label": "Límite de la vía", "type": "number", "unit": "km/h", "origin": "ROAD_NETWORK", "engineSupported": true},
              {"path": "signal.road.maxspeed_custom", "label": "Límite propio", "type": "number", "unit": "km/h", "engineSupported": true},
              {"path": "signal.geo.authorized_zone", "label": "En zona autorizada", "type": "bool", "origin": "ZONES", "engineSupported": true},
              {"path": "signal.geo.zone", "label": "Zona", "type": "zone", "origin": "ZONES", "engineSupported": true},
              {"path": "signal.local_hour", "label": "Hora local", "type": "number", "engineSupported": true},
              {"path": "signal.derived.speed_avg_5m", "label": "Velocidad promedio 5 min", "type": "number", "unit": "km/h", "origin": "CALCULATED", "engineSupported": false}
            ]
            """;

    private static final String FRAME = """
            {"asset_id":"ABCD12","timestamp":"2026-10-21T12:00:00Z",
             "gps":{"latitude":-33.45,"longitude":-70.66,"speed":42.5},
             "sensors":{"engine_status":true,"panic_button":true},
             "driver_info":{"name":"x"}}
            """;

    private static Map<String, SourceField> byPath() {
        return SignalFields.fields().stream().collect(Collectors.toMap(SourceField::path, Function.identity()));
    }

    @Test
    void keepsTheFieldsSavedSymptomsUse() throws Exception {
        Map<String, SourceField> fields = byPath();
        for (SourceField declared : JSON.readValue(DECLARED, new TypeReference<List<SourceField>>() {
        })) {
            assertEquals(declared, fields.get(declared.path()), declared.path());
        }
    }

    @Test
    void readsThePanicButtonFromTheFrame() {
        SourceField panic = byPath().get("signal.frame.sensors.panic_button");

        assertEquals("bool", panic.type());
        assertEquals(FieldOrigin.DEVICE, panic.origin());
        assertEquals("Botón de pánico presionado", panic.label());
        assertTrue(panic.engineSupported());
    }

    @Test
    void everyFrameFieldHasALabel() throws Exception {
        Properties labels = new Properties();
        labels.load(new InputStreamReader(SignalFields.class.getResourceAsStream(SignalFields.LABELS),
                StandardCharsets.UTF_8));
        List<String> missing = SignalFields.fields().stream().map(SourceField::path)
                .filter(p -> p.startsWith("signal.frame.") && !labels.containsKey(p)).toList();

        assertEquals(List.of(), missing, "add these paths to " + SignalFields.LABELS);
    }

    @Test
    void leavesOutDriverDataListsAndHiddenParts() {
        Map<String, SourceField> fields = byPath();

        assertTrue(fields.keySet().stream().noneMatch(p -> p.contains("driver_info") || p.contains("metrics")
                || p.contains("peripherals") || p.contains("events")));
        assertTrue(fields.keySet().stream().noneMatch(p -> p.equals("signal.schema") || p.equals("signal.at")
                || p.startsWith("signal.clients") || p.equals("signal.frame.asset_id")));
    }

    @Test
    void everyFieldIsAPathOfTheSerializedSignal() throws Exception {
        AssetTrackingData frame = JSON.readValue(FRAME, AssetTrackingData.class);
        GpsSignal signal = new GpsSignal(GpsSignal.SCHEMA, "ABCD12", null, List.of("client-1"),
                new GpsSignal.Trip(true, false, "T-1"),
                new GpsSignal.Vehicle(GpsSignal.WeightCategory.HEAVY, 30000.0),
                new GpsSignal.Gps(42.5, true, true), new GpsSignal.Road(90.0, 80.0),
                new GpsSignal.Geo(false, "Z-1"), 14, new GpsSignal.Derived(40.0), frame);
        Map<String, Object> root = Map.of(SignalFields.ROOT, JSON.convertValue(signal, new TypeReference<>() {
        }));

        for (String path : List.of("signal.trip.active", "signal.vehicle.weight_category", "signal.gps.speed_kmh",
                "signal.road.maxspeed_osm", "signal.geo.zone", "signal.local_hour", "signal.derived.speed_avg_5m",
                "signal.frame.gps.speed", "signal.frame.sensors.panic_button")) {
            assertTrue(byPath().containsKey(path), path);
            assertTrue(valueAt(root, path) != null, path);
        }
        assertEquals(Boolean.TRUE, valueAt(root, "signal.frame.sensors.panic_button"));
        assertEquals(GpsSignal.SCHEMA, valueAt(root, "signal.schema"));
    }

    @SuppressWarnings("unchecked")
    private static Object valueAt(Map<String, Object> root, String path) {
        Object node = root;
        for (String part : path.split("\\.")) {
            node = node instanceof Map<?, ?> m ? ((Map<String, Object>) m).get(part) : null;
        }
        return node;
    }
}
