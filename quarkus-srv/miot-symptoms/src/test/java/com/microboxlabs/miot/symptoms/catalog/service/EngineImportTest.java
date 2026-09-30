package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.EngineImportService.ImportResult;
import com.microboxlabs.miot.symptoms.catalog.service.EngineRuleTranslator.Translation;
import com.microboxlabs.miot.symptoms.engine.DemoSymptomEngine;
import com.microboxlabs.miot.symptoms.engine.EngineRule;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EngineImportTest {

    private static EngineRule rule(int id, String name, String trigger, Map<String, Object> pattern) {
        return new EngineRule(id, name, trigger, new LinkedHashMap<>(pattern), true, List.of(), false);
    }

    private static SpecValidator.Report check(Translation t, DataSourceService sources) {
        return SpecValidator.validate(t.spec(), sources.find("tenant-a", t.sourceKey()).orElseThrow());
    }

    private final DataSourceService sources = new DataSourceService(new InMemoryCatalog(), new UnavailableSymptomEngine());

    @Test
    void speedingBecomesAMeasureWithTheEnginesLadder() {
        Translation t = EngineRuleTranslator.translate(rule(9, "Exceso de velocidad estandar", "signal",
                Map.of("in_trip", 1, "cooldown_seconds", 120, "maxspeed_infraction_osm", 1)));

        assertEquals("exceso-de-velocidad-estandar-9", t.key());
        assertEquals("signal.trip.active", t.spec().activation());
        assertEquals("signal.gps.speed_kmh - signal.road.maxspeed_osm", t.spec().measure().expression());
        assertEquals("caso.normal_s >= 120", t.spec().lifecycle().close());
        assertEquals("SPEED LIMIT STANDARD", t.icon());
        assertTrue(t.pending().isEmpty());
        assertTrue(check(t, sources).publishable(), () -> check(t, sources).findings().toString());
    }

    @Test
    void nightMovementGetsAnHourWindowAcrossMidnight() {
        Translation t = EngineRuleTranslator.translate(rule(58, "Pernoctación en zona no autorizada", "signal",
                Map.of("in_trip", 1, "start_hour", "21:00:00", "end_hour", "05:59:59", "double_driver", 0,
                        "evaluate_time", 1, "movement_status", 0, "respect_permanently_closed", 1)));

        assertTrue(t.spec().activation().contains("(signal.local_hour >= 21 || signal.local_hour < 6)"),
                t.spec().activation());
        assertTrue(t.spec().activation().contains("!signal.trip.double_driver"));
        assertTrue(t.spec().activation().contains("!signal.gps.moving"));
        assertEquals(List.of("respect_permanently_closed = 1"), t.pending());
        assertTrue(check(t, sources).publishable(), () -> check(t, sources).findings().toString());
    }

    @Test
    void eventsMatchTheirTypeAtOneLevel() {
        Translation t = EngineRuleTranslator.translate(rule(18, "Ausencia de Amarre y Sujecion", "event",
                Map.of("tipo_evento", "AAS")));

        assertEquals("device_event", t.sourceKey());
        assertEquals("event.type == \"AAS\"", t.spec().activation());
        assertTrue(check(t, sources).publishable(), () -> check(t, sources).findings().toString());
    }

    @Test
    void jobsReadThePeriodicCheck() {
        Translation t = EngineRuleTranslator.translate(rule(12, "Perdida de señal", "job",
                Map.of("in_trip", 1, "lost_signal", 1)));

        assertEquals("trip_check", t.sourceKey());
        assertEquals("check.trip.active", t.spec().activation());
        assertEquals("check.signal_lost_minutes", t.spec().measure().expression());
        assertTrue(check(t, sources).publishable(), () -> check(t, sources).findings().toString());
    }

    @Test
    void importCreatesOffDraftsOnceAndNeedsAnEngine() {
        InMemoryCatalog store = new InMemoryCatalog();
        DataSourceService withEngine = new DataSourceService(store, new DemoSymptomEngine());
        SymptomCatalogService catalog = new SymptomCatalogService(store, withEngine,
                new AuditService(new InMemoryAuditStore()));
        EngineImportService importer = new EngineImportService(new DemoSymptomEngine(), catalog);

        ImportResult first = importer.importRules("tenant-a", "owner@example.com");
        ImportResult again = importer.importRules("tenant-a", "owner@example.com");

        assertEquals(1, first.created().size());
        assertEquals(0, again.created().size());
        assertEquals(1, again.skipped());
        var detail = catalog.get("tenant-a", java.util.UUID.fromString(first.created().get(0).id()));
        assertEquals(SymptomState.OFF, detail.definition().state());
        assertEquals(9, detail.definition().engineRuleId());
        assertTrue(detail.draft() != null && detail.current() == null);

        EngineImportService offline = new EngineImportService(new UnavailableSymptomEngine(), catalog);
        assertThrows(IllegalStateException.class, () -> offline.importRules("tenant-a", "owner@example.com"));
    }
}
