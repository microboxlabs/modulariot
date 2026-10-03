package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.PreviewService.SamplePreview;
import com.microboxlabs.miot.symptoms.engine.DemoSymptomEngine;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import java.util.List;
import org.junit.jupiter.api.Test;

class SourcesAndPreviewTest {

    private static final String TENANT = "tenant-a";

    @Test
    void platformSourcesAreSeededOnFirstUse() {
        DataSourceService sources = new DataSourceService(new InMemoryCatalog(), new UnavailableSymptomEngine());

        List<String> keys = sources.list(TENANT).stream().map(DataSource::key).toList();

        assertEquals(List.of("gps_signal", "device_event", "trip_check"), keys);
        assertTrue(sources.get(TENANT, "gps_signal").samples().isEmpty(), "no engine, no GPS samples");
        assertEquals(2, sources.get(TENANT, "trip_check").samples().size());
    }

    @Test
    void unconfirmedOriginsAreLeftOut() {
        DataSourceService sources = new DataSourceService(new InMemoryCatalog(), new UnavailableSymptomEngine());

        SourceField custom = sources.get(TENANT, "gps_signal").fields().stream()
                .filter(f -> f.path().equals("signal.road.maxspeed_custom")).findFirst().orElseThrow();

        assertNull(custom.origin());
    }

    @Test
    void theSpeedingRulesRunOnEngineSamples() {
        DataSourceService sources = new DataSourceService(new InMemoryCatalog(), new DemoSymptomEngine());
        DataSource gps = sources.get(TENANT, "gps_signal");

        List<SamplePreview> results = PreviewService.run(Specs.speeding(), gps);

        assertEquals(3, results.size());
        assertEquals(22.0, results.get(0).measure());
        assertEquals(4, results.get(0).level(), "22 km/h over, held 75 s: código negro");
        assertEquals(3, results.get(1).level(), "11 km/h over, held 20 s: crítica");
        assertFalse(results.get(2).activates(), "a light vehicle does not activate");
        assertNull(results.get(2).level());
    }

    @Test
    void eachConditionOfTheActivationIsRunOnItsOwn() {
        DataSource gps = new DataSourceService(new InMemoryCatalog(), new DemoSymptomEngine()).get(TENANT, "gps_signal");

        List<SamplePreview> results = PreviewService.run(Specs.speeding(), gps);

        List<PreviewService.Clause> light = results.get(2).clauses();
        assertEquals(List.of("signal.trip.active", "signal.vehicle.weight_category == \"HEAVY\""),
                light.stream().map(PreviewService.Clause::text).toList());
        assertEquals(List.of(true, false), light.stream().map(PreviewService.Clause::holds).toList(),
                "the light vehicle fails only the weight condition");
        assertEquals("LIGHT", light.get(1).values().get("signal.vehicle.weight_category"));

        SymptomSpec missing = Specs.with(Specs.speeding(), Specs.ACTIVATION + " && signal.nope == 1");
        PreviewService.Clause broken = PreviewService.run(missing, gps).get(0).clauses().get(2);
        assertNull(broken.holds());
        assertNull(broken.values().get("signal.nope"));

        SymptomSpec or = Specs.with(Specs.speeding(), "signal.trip.active || signal.gps.speed_kmh > 0");
        assertTrue(PreviewService.run(or, gps).get(0).clauses().isEmpty(), "an || rule has no clause list");

        SymptomSpec ternary = Specs.with(Specs.speeding(),
                "signal.trip.active ? signal.gps.speed_kmh > 0 && signal.gps.speed_kmh < 200 : false");
        assertTrue(PreviewService.run(ternary, gps).get(0).clauses().isEmpty(),
                "&& inside a conditional is not the rule's own conjunction");
        SymptomSpec grouped = Specs.with(Specs.speeding(), "(signal.trip.active && signal.gps.speed_kmh > 0)");
        assertEquals(2, PreviewService.run(grouped, gps).get(0).clauses().size(), "parentheses are looked through");
    }

    @Test
    void wrongResultTypesAndFailingLevelsAreReportedNotThrown() {
        DataSource gps = new DataSourceService(new InMemoryCatalog(), new DemoSymptomEngine()).get(TENANT, "gps_signal");
        SymptomSpec base = Specs.speeding();

        SymptomSpec boolMeasure = new SymptomSpec(base.source(), base.activation(),
                new SymptomSpec.Measure("true", null, null), base.levels(), base.lifecycle(), null);
        assertEquals("La medida debe dar un número.", PreviewService.run(boolMeasure, gps).get(0).error());

        SymptomSpec numberActivation = Specs.with(base, "signal.gps.speed_kmh");
        assertEquals("La condición debe dar sí o no.", PreviewService.run(numberActivation, gps).get(0).error());

        SymptomSpec badLevel = Specs.withLevels(base, Specs.levels("medida > 0 && medida < 5",
                "medida >= 5 && medida < 11", "medida >= 11 && medida < 21", "medida >= 21 && signal.nope > 1.0"));
        assertTrue(PreviewService.run(badLevel, gps).get(0).error().startsWith("Nivel 4: "));
    }

    @Test
    void aBrokenRuleReportsItsErrorPerSample() {
        DataSourceService sources = new DataSourceService(new InMemoryCatalog(), new DemoSymptomEngine());

        SamplePreview first = PreviewService.run(Specs.with(Specs.speeding(), "signal.trip.activo"),
                sources.get(TENANT, "gps_signal")).get(0);

        assertEquals("El campo «activo» no existe en esta fuente.", first.error());
    }

    @Test
    void theLifecycleRunsOnEachCaseMoment() {
        List<PreviewService.CasePreview> cases = PreviewService.cases(new SymptomSpec.Lifecycle(
                "caso.condicion_s >= 60", "caso.normal_s >= 120 || caso.cerrado_por_operador"));

        assertEquals(List.of("detected", "held", "ongoing", "normal", "closed_by_operator"),
                cases.stream().map(PreviewService.CasePreview::scenario).toList());
        assertEquals(List.of("waits", "opens", "stays_open", "closes", "closes"),
                cases.stream().map(PreviewService.CasePreview::outcome).toList());
        assertEquals(-1.0, ((java.util.Map<?, ?>) cases.get(2).sample().get("caso")).get("normal_s"),
                "normal_s is -1 while the condition holds, as the engine writes it");
    }

    @Test
    void aLifecycleRuleThatFailsIsReportedPerMoment() {
        List<PreviewService.CasePreview> cases = PreviewService.cases(
                new SymptomSpec.Lifecycle("caso.condicion_s", "caso.nope > 1"));

        assertNull(cases.get(0).outcome());
        assertEquals("La condición debe dar sí o no.", cases.get(0).error());
        assertNull(cases.get(2).outcome());
        assertTrue(cases.get(2).error() != null && !cases.get(2).error().isBlank());
        assertTrue(PreviewService.cases(null).isEmpty());
    }
}
