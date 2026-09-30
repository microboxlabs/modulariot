package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
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
    void aBrokenRuleReportsItsErrorPerSample() {
        DataSourceService sources = new DataSourceService(new InMemoryCatalog(), new DemoSymptomEngine());

        SamplePreview first = PreviewService.run(Specs.with(Specs.speeding(), "signal.trip.activo"),
                sources.get(TENANT, "gps_signal")).get(0);

        assertEquals("El campo «activo» no existe en esta fuente.", first.error());
    }
}
