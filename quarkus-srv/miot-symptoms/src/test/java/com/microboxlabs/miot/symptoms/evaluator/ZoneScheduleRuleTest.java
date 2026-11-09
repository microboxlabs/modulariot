package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.EnvelopedMessage;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceKind;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.signal.GpsSignal;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache;
import com.microboxlabs.miot.symptoms.signal.SignalBuilder;
import com.microboxlabs.miot.symptoms.signal.SignalFields;
import com.microboxlabs.miot.symptoms.signal.Zones;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** A rule reads the zone's own risk schedule from {@code signal.geo}, built from a frame by the signal builder. */
class ZoneScheduleRuleTest {

    private static final String TENANT = "tenant-a";
    private static final String RULE = "signal.?geo.?risk_zone == TRUE && signal.?geo.?risk_scheduled == TRUE"
            + " && signal.?geo.?in_risk_schedule == TRUE";
    private static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private static final String SQUARE = """
            {"type":"Polygon","coordinates":[[[-70.1,-33.1],[-69.9,-33.1],[-69.9,-32.9],[-70.1,-32.9],[-70.1,-33.1]]]}
            """;

    private final SignalBuilder builder = builder();

    private static SignalBuilder builder() {
        Zones zones = new Zones();
        zones.load(List.of(Zones.zone(TENANT, 1, "1", "Zona de prueba",
                "[{\"start\":\"18:00\",\"end\":\"09:00\"}]", SQUARE)));
        ReferenceCache refs = new ReferenceCache();
        refs.load(List.of(), List.of());
        return new SignalBuilder(refs, ZoneId.of("America/Santiago"), zones);
    }

    private static CompiledSymptom symptom() {
        DataSource source = new DataSource(UUID.randomUUID(), null, "gps_signal", "Señal GPS", SourceKind.SIGNAL,
                "signal", "Cada pulso", SignalFields.fields(), List.of());
        SymptomSpec spec = new SymptomSpec("gps_signal", RULE, null,
                Specs.levels("held_s >= 0", "held_s >= 600", "held_s >= 1200", "held_s >= 1800"),
                new SymptomSpec.Lifecycle("case.condition_s >= 0", "case.normal_s >= 0"), null);
        return CompiledSymptom.compile(UUID.randomUUID(), "1.0.0", SymptomState.TEST, spec, source);
    }

    /** The signal of a frame at this time, as the evaluator gives it to the tenant. */
    private Map<String, Object> signal(String at) {
        String frame = """
                {"requestId":"r-1","clientId":"%s@clients","timestamp":"%s",
                 "payload":{"asset_id":"ABCD12","timestamp":"%s","gps":{"latitude":-33.0,"longitude":-70.0,"speed":0}}}
                """.formatted(TENANT, at, at);
        GpsSignal signal = builder.build(EnvelopedMessage.fromJson(frame)).orElseThrow();
        Map<String, Object> map = JSON.convertValue(signal, new TypeReference<>() {
        });
        return Map.of("signal", EvaluatorStream.forTenant(map, TENANT));
    }

    private static List<String> kinds(SignalEvaluator.Result r) {
        return r.transitions().stream().map(t -> t.kind().toString()).toList();
    }

    @Test
    void theRuleOpensInsideTheZonesWindowAndNotOutside() {
        SignalEvaluator evaluator = new SignalEvaluator(new InMemoryEpisodeStore());
        List<CompiledSymptom> symptoms = List.of(symptom());
        // October in Santiago is UTC-3.
        String noon = "2026-10-21T15:00:00Z";
        String beforeWindow = "2026-10-21T20:59:00Z";
        String windowStart = "2026-10-21T21:00:00Z";

        SignalEvaluator.Result atNoon = evaluator.evaluate(TENANT, "ABCD12", Instant.parse(noon), signal(noon), symptoms);
        assertEquals(List.of(), kinds(atNoon), "12:00 local: a risk zone, outside its schedule");
        assertTrue(atNoon.errors().isEmpty(), atNoon.errors().toString());
        assertEquals(List.of(), kinds(evaluator.evaluate(TENANT, "ABCD12", Instant.parse(beforeWindow),
                signal(beforeWindow), symptoms)), "17:59 local");
        assertEquals(List.of("OPENED"), kinds(evaluator.evaluate(TENANT, "ABCD12", Instant.parse(windowStart),
                signal(windowStart), symptoms)), "18:00 local opens");
    }
}
