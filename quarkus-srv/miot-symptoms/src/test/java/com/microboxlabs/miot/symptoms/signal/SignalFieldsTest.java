package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.AssetTrackingData;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.symptoms.catalog.domain.FieldOrigin;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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
              {"path": "signal.frame.gps.speed", "label": "Velocidad", "type": "number", "unit": "km/h", "origin": "DEVICE", "engineSupported": true},
              {"path": "signal.frame.sensors.engine_status", "label": "Motor encendido", "type": "bool", "origin": "DEVICE", "engineSupported": true},
              {"path": "signal.derived.moving", "label": "En movimiento", "type": "bool", "origin": "CALCULATED", "engineSupported": true},
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
            SourceField f = fields.get(declared.path());
            assertNotNull(f, declared.path());
            assertEquals(declared, new SourceField(f.path(), f.label(), f.type(), f.unit(), f.origin(),
                    f.engineSupported(), f.values()), declared.path());
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
                .filter(p -> p.startsWith("signal.frame.") && !labels.containsKey(p))
                // A list's fields are labelled by its declared type (GpsSignal.FrameEvent).
                .filter(p -> SignalFields.LISTS.keySet().stream().noneMatch(l -> p.equals(l) || p.startsWith(l + ".")))
                .toList();

        assertEquals(List.of(), missing, "add these paths to " + SignalFields.LABELS);
    }

    @Test
    void everyFieldOfBothSourcesHasATitle() {
        List<SourceField> all = new ArrayList<>(SignalFields.fields());
        all.addAll(SignalFields.fields(TripCheck.class, TripCheck.ROOT));
        List<String> untitled = all.stream()
                .filter(f -> f.label() == null || f.label().equals(f.path().substring(f.path().lastIndexOf('.') + 1)))
                .map(SourceField::path).toList();

        assertEquals(List.of(), untitled, "give these fields a @Schema title");
    }

    @Test
    void theTripCheckListsTheFramesZoneFields() {
        Map<String, SourceField> check = new java.util.HashMap<>();
        SignalFields.fields(TripCheck.class, TripCheck.ROOT).forEach(f -> check.put(f.path(), f));

        assertEquals("En zona autorizada", check.get("check.geo.authorized_zone").label());
        assertEquals(FieldOrigin.ZONES, check.get("check.geo.outside_authorized").origin());
        assertTrue(check.containsKey("check.geo.zone"));
        assertTrue(check.containsKey("check.geo.risk_zone"));
        for (String field : List.of("authorized_zone", "zone", "risk_zone", "outside_authorized",
                "risk_scheduled", "in_risk_schedule")) {
            String description = check.get("check.geo." + field).description();
            assertNotNull(description, field);
            assertTrue(description.contains("no viene en las revisiones"), field);
            assertTrue(description.contains("la regla también debe leer"), field);
            assertTrue(description.contains("check.?geo.?authorized_zone.orValue(false)"), field);
        }
        assertTrue(check.get("check.geo.authorized_zone").description()
                .startsWith("Dentro de al menos una zona autorizada"), "keep each leaf's own description");
    }

    @Test
    void passesTheSchemaDescription() {
        Map<String, SourceField> fields = byPath();

        assertEquals("Dentro de al menos una zona autorizada",
                fields.get("signal.geo.authorized_zone").description());
        assertEquals("Los eventos del equipo que trae la trama", fields.get("signal.frame.events").description());
        assertEquals(null, fields.get("signal.trip.age_min").description());
        assertEquals("min", fields.get("signal.trip.age_min").unit());
        assertEquals(FieldOrigin.TRIP, fields.get("signal.trip.age_min").origin());
    }

    @Test
    void etaDeviationIsAvailableToRulesInMinutesFromTheTrip() {
        SourceField field = byPath().get("signal.trip.eta_deviation_min");

        assertNotNull(field);
        assertEquals("number", field.type());
        assertEquals("min", field.unit());
        assertEquals(FieldOrigin.TRIP, field.origin());
        assertTrue(field.engineSupported());
        assertNotNull(field.description());
    }

    @Test
    void roadProvenanceHasLabelsDescriptionsAndOriginsWhileTenantMapsAreHidden() {
        Map<String, SourceField> fields = byPath();
        for (String name : List.of("osm_way_id", "road_class", "custom_zone_id")) {
            SourceField field = fields.get("signal.road." + name);
            assertNotNull(field);
            assertNotNull(field.description());
            assertTrue(field.engineSupported());
            assertEquals(name.equals("custom_zone_id") ? FieldOrigin.TENANT_SETTINGS : FieldOrigin.ROAD_NETWORK,
                    field.origin());
        }
        assertTrue(fields.keySet().stream().noneMatch(p -> p.startsWith("signal.roads")));
    }

    @Test
    void leavesOutDriverDataListsAndHiddenParts() {
        Map<String, SourceField> fields = byPath();

        assertTrue(fields.keySet().stream().noneMatch(p -> p.contains("driver_info") || p.contains("metrics")
                || p.contains("peripherals")));
        assertTrue(fields.keySet().stream().noneMatch(p -> p.equals("signal.schema") || p.equals("signal.at")
                || p.startsWith("signal.clients") || p.equals("signal.frame.asset_id")));
    }

    @Test
    void leavesOutOptionalReadingsOutsideTheRuleSchema() {
        Map<String, SourceField> fields = byPath();

        assertTrue(fields.containsKey("signal.frame.gps.latitude"), "required primitives stay");
        assertTrue(fields.containsKey("signal.frame.gps.speed"), "a missing speed reads as stopped");
        for (String path : List.of("signal.frame.gps.altitude", "signal.frame.gps.heading",
                "signal.frame.gps.satellites", "signal.frame.gps.accuracy.horizontal")) {
            assertTrue(!fields.containsKey(path), path);
        }
    }

    @Test
    void everyFieldIsAPathOfTheSerializedSignal() throws Exception {
        AssetTrackingData frame = JSON.readValue(FRAME, AssetTrackingData.class);
        GpsSignal signal = new GpsSignal(GpsSignal.SCHEMA_ID, "ABCD12", null, null, List.of("client-1"), "client-1", null, null,
                new GpsSignal.Trip(true, false, "T-1", "SVC-1", "v", "in_transit", 30.0, -5.0, new GpsSignal.Origin(32, "ANF", true, true),
                        new GpsSignal.Destination(17, "SPC", false), 4, new GpsSignal.Carrier("1-9", "Transportes"),
                        "rampla", "AB1234", new GpsSignal.Driver("d-1", true, GpsSignal.DriverStatus.ACTIVE, false)),
                new GpsSignal.Vehicle(GpsSignal.WeightCategory.HEAVY, 30000.0),
                new GpsSignal.Road(90.0, 80.0, 1L, "primary", 3), null,
                new GpsSignal.Geo(false, "Z-1", true, true), null, 14, 870.5,
                new GpsSignal.Derived(true, 40.0, false, false), frame);
        Map<String, Object> root = Map.of(SignalFields.ROOT, JSON.convertValue(signal, new TypeReference<>() {
        }));

        for (String path : List.of("signal.trip.active", "signal.trip.code", "signal.trip.status",
                "signal.trip.late_min", "signal.trip.origin.label",
                "signal.trip.destination.visited", "signal.trip.carrier.name", "signal.trip.driver.status",
                "signal.trip.driver.license_expired", "signal.vehicle.weight_category", "signal.frame.gps.speed",
                "signal.road.maxspeed_osm", "signal.geo.zone", "signal.geo.risk_zone",
                "signal.geo.outside_authorized", "signal.local_hour", "signal.local_minutes", "signal.derived.moving",
                "signal.derived.speed_avg_5m", "signal.frame.sensors.engine_status",
                "signal.frame.gps.latitude", "signal.frame.sensors.panic_button")) {
            assertTrue(byPath().containsKey(path), path);
            assertNotNull(valueAt(root, path), path);
        }
        assertEquals(Boolean.TRUE, valueAt(root, "signal.frame.sensors.panic_button"));
        assertEquals(GpsSignal.SCHEMA_ID, valueAt(root, "signal.schema"));
    }

    @Test
    void theFrameEventsAreAListOfObjects() {
        Map<String, SourceField> fields = byPath();

        SourceField events = fields.get("signal.frame.events");
        assertEquals("objects", events.type());
        assertEquals("Eventos del GPS", events.label());
        assertEquals(FieldOrigin.DEVICE, events.origin());
        assertEquals("text", fields.get("signal.frame.events.event_type").type());
        assertEquals("Tipo de evento", fields.get("signal.frame.events.event_type").label());
        assertEquals("text", fields.get("signal.frame.events.severity").type());
        assertEquals("text", fields.get("signal.frame.events.description").type());
        assertEquals("time", fields.get("signal.frame.events.timestamp").type());
        assertTrue(fields.keySet().stream().noneMatch(p -> p.contains("additional_info")
                || p.contains("threshold_exceeded")));
    }

    @Test
    void theFrameEventsAreReadWithEveryValueAText() {
        Map<String, Object> signal = Map.of("frame", Map.of("events", List.of(
                Map.of("event_type", "device_tamper", "timestamp", "2026-01-01T12:00:00Z"), "not an event")));

        Map<String, Object> read = GpsSignal.FrameEvent.withEvents(signal);

        assertEquals(List.of(Map.of("event_type", "device_tamper", "severity", "", "description", "",
                "timestamp", "2026-01-01T12:00:00Z", "code", "")), ((Map<?, ?>) read.get("frame")).get("events"));
        assertEquals(List.of(), ((Map<?, ?>) GpsSignal.FrameEvent.withEvents(Map.of("frame", Map.of()))
                .get("frame")).get("events"), "a frame without events reads an empty list");
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
