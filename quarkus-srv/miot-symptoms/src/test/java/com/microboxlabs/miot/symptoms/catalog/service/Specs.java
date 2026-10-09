package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.FieldOrigin;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceKind;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Response;
import java.util.List;
import java.util.UUID;

/** The speeding symptom as a test fixture. */
public final class Specs {

    public static final String ACTIVATION = "signal.trip.active && signal.vehicle.weight_category == \"HEAVY\"";

    private Specs() {
    }

    public static DataSource gpsSignal() {
        return new DataSource(UUID.randomUUID(), null, "gps_signal", "Señal GPS", SourceKind.SIGNAL, "signal",
                "Cada pulso", List.of(
                        new SourceField("signal.trip.active", "En viaje", "bool", null, FieldOrigin.TRIP, true),
                        new SourceField("signal.vehicle.weight_category", "Categoría de peso", "list", null,
                                FieldOrigin.VEHICLE, true, List.of(new SourceField.FieldValue("HEAVY", "Pesado"),
                                        new SourceField.FieldValue("LIGHT", "Liviano"))),
                        new SourceField("signal.gps.speed_kmh", "Velocidad", "number", "km/h", FieldOrigin.DEVICE, true),
                        new SourceField("signal.road.maxspeed_osm", "Límite", "number", "km/h",
                                FieldOrigin.ROAD_NETWORK, true),
                        new SourceField("signal.derived.speed_avg_5m", "Promedio 5 min", "number", "km/h",
                                FieldOrigin.CALCULATED, false)),
                List.of());
    }

    public static SymptomSpec speeding() {
        return new SymptomSpec("gps_signal", ACTIVATION,
                new SymptomSpec.Measure("signal.gps.speed_kmh - signal.road.maxspeed_osm", "Exceso", "km/h"),
                levels("medida > 0 && medida < 5", "medida >= 5 && medida < 11", "medida >= 11 && medida < 21",
                        "medida >= 21 && sostenido_s >= 60"),
                new SymptomSpec.Lifecycle("caso.condicion_s >= 0", "caso.normal_s >= 120"), null);
    }

    public static List<Level> levels(String... when) {
        return List.of(
                new Level(1, true, when[0], response(false, null)),
                new Level(2, true, when[1], response(false, null)),
                new Level(3, true, when[2], response(true, 5)),
                new Level(4, true, when[3], response(true, 2)));
    }

    public static Response response(boolean operator, Integer sla) {
        return new Response(operator, sla, List.of(), List.of(), List.of(), true);
    }

    public static SymptomSpec with(SymptomSpec s, String activation) {
        return new SymptomSpec(s.source(), activation, s.measure(), s.levels(), s.lifecycle(), s.recurrence());
    }

    public static SymptomSpec withLevels(SymptomSpec s, List<Level> levels) {
        return new SymptomSpec(s.source(), s.activation(), s.measure(), levels, s.lifecycle(), s.recurrence());
    }
}
