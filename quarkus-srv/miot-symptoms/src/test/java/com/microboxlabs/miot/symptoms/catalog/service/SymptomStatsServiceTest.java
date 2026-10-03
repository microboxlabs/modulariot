package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomStatsService.PerSymptom;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomStatsService.SymptomStats;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.engine.EngineCase;
import com.microboxlabs.miot.symptoms.engine.EngineRule;
import com.microboxlabs.miot.symptoms.engine.LevelCount;
import com.microboxlabs.miot.symptoms.engine.SymptomEngine;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService.SettingsRequest;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTowerSettingsStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SymptomStatsServiceTest {

    private static final String TENANT = "tenant-a";
    private static final String OWNER = "owner@example.com";
    private static final String ENGINE_NAME = "Speed Limit Standard";
    private static final OffsetDateTime NOW = OffsetDateTime.of(2026, 10, 2, 12, 0, 0, 0, ZoneOffset.UTC);

    private SymptomCatalogService catalog;
    private InMemoryTreatmentStore treatments;
    private TowerSettingsService settings;
    private FakeEngine engine;

    /** An engine whose counts and cases the test sets. */
    private static final class FakeEngine implements SymptomEngine {
        boolean available = true;
        boolean failing;
        final List<LevelCount> counts = new ArrayList<>();
        final List<EngineCase> cases = new ArrayList<>();

        @Override
        public boolean available() {
            return available;
        }

        @Override
        public List<EngineRule> rules(String tenantCode) {
            return List.of();
        }

        @Override
        public List<LevelCount> levelCounts(String tenantCode, OffsetDateTime from, OffsetDateTime to) {
            if (failing) {
                throw new IllegalStateException("gps down");
            }
            assertEquals(NOW.minusDays(90), from);
            assertEquals(NOW, to);
            return counts;
        }

        @Override
        public List<EngineCase> recentCases(String tenantCode, String symptomName, OffsetDateTime since, int limit) {
            assertEquals(NOW.minusDays(7), since);
            return cases.stream().filter(c -> c.symptomName().equals(symptomName)).toList();
        }

        @Override
        public List<Map<String, Object>> signalSamples(String tenantCode, int limit) {
            return List.of();
        }
    }

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        store.upsert(Specs.gpsSignal());
        catalog = new SymptomCatalogService(store, new DataSourceService(store, new UnavailableSymptomEngine()),
                new AuditService(new InMemoryAuditStore()));
        treatments = new InMemoryTreatmentStore();
        settings = new TowerSettingsService(new InMemoryTowerSettingsStore(), new AuditService(new InMemoryAuditStore()));
        engine = new FakeEngine();
    }

    private SymptomStatsService service() {
        return new SymptomStatsService(catalog, engine, treatments, settings, () -> NOW);
    }

    private UUID symptom(String key, String name, String icon, SymptomState state) {
        UUID id = catalog.create(TENANT, OWNER, new CreateRequest(key, name, null, icon, null, "gps_signal", null,
                Specs.speeding())).definition().id();
        catalog.publish(TENANT, OWNER, id, "Primera versión de " + key, null, state);
        return id;
    }

    private static EngineCase engineCase(long id, int icu, OffsetDateTime first) {
        return new EngineCase(id, ENGINE_NAME, icu, "trip-" + id, first, first.plusMinutes(1), BigDecimal.TEN, true,
                false);
    }

    private void take(long symptomId, OffsetDateTime at) {
        treatments.insert(new Treatment(null, TENANT, symptomId, "asset", "trip", TreatmentType.CALL,
                TreatmentStatus.OPEN, "ops@example.com", at, null, null, null, null, null));
    }

    @Test
    void withoutAnEngineOnlyTheCatalogNumbersAreReturned() {
        engine.available = false;
        symptom("speeding", "Exceso", ENGINE_NAME, SymptomState.ACTIVE);
        SymptomStats stats = service().stats(TENANT);
        assertFalse(stats.engineAvailable());
        assertEquals(List.of(0L, 0L, 0L, 0L), stats.totals().weekByLevel());
        assertNull(stats.totals().topShare());
        assertEquals(8, stats.operators().shiftHours());
        assertNull(stats.operators().slaMetLastWeek());
        assertEquals("Exceso", stats.changes().lastPublished().name());
    }

    @Test
    void anEngineThatFailsReadsAsNotConnected() {
        engine.failing = true;
        assertFalse(service().stats(TENANT).engineAvailable());
    }

    @Test
    void engineCasesAreCreditedToOneDefinitionAsWeeklyAverages() {
        UUID active = symptom("speeding", "Exceso", ENGINE_NAME, SymptomState.ACTIVE);
        UUID test = symptom("speeding-copy", "Exceso", ENGINE_NAME, SymptomState.TEST);
        engine.counts.addAll(List.of(new LevelCount(ENGINE_NAME, 2, 900), new LevelCount(ENGINE_NAME, 3, 450),
                new LevelCount(ENGINE_NAME, 4, 90), new LevelCount("Otro motor", 1, 180),
                new LevelCount(ENGINE_NAME, 5, 9000), new LevelCount(null, 2, 90)));

        SymptomStats stats = service().stats(TENANT);

        assertTrue(stats.engineAvailable());
        assertEquals(1, stats.symptoms().size(), "the TEST duplicate gets nothing");
        PerSymptom p = stats.symptoms().get(0);
        assertEquals(active, p.definitionId());
        assertEquals(List.of(0L, 70L, 35L, 7L), p.weekByLevel());
        assertEquals(112, p.week());
        assertEquals(42, p.operatorWeek(), "levels 3 and 4 need an operator");
        assertEquals(List.of(14L, 77L, 35L, 7L), stats.totals().weekByLevel(), "unmatched names count in totals");
        assertEquals(133, stats.totals().week());
        assertEquals(2, stats.totals().perShift(), "42 a week over 21 eight-hour shifts");
        assertEquals(List.of(active), stats.totals().topShare().definitionIds());
        assertEquals(112.0 / 133, stats.totals().topShare().share(), 1e-9);
        assertTrue(stats.symptoms().stream().noneMatch(s -> s.definitionId().equals(test)));
    }

    @Test
    void operatorLoadCountsActiveSymptomsOnlyAndFollowsTheShiftLength() {
        symptom("speeding", "Exceso", ENGINE_NAME, SymptomState.TEST);
        engine.counts.add(new LevelCount(ENGINE_NAME, 4, 900));
        assertEquals(0, service().stats(TENANT).totals().perShift(), "a TEST symptom asks no operator");

        catalog.setState(TENANT, OWNER, catalog.list(TENANT).get(0).definition().id(), SymptomState.ACTIVE);
        settings.save(TENANT, OWNER, new SettingsRequest(3, 12, 150));
        SymptomStats stats = service().stats(TENANT);
        assertEquals(5, stats.totals().perShift(), "70 a week over 14 twelve-hour shifts");
        assertEquals(3, stats.operators().operators());
        assertEquals(150, stats.operators().capacityPerShift());
        assertEquals(12, stats.operators().shiftHours());
    }

    @Test
    void slaMetCountsCasesTakenWithinTheLevelSlaOnceTheSlaRanOut() {
        symptom("speeding", "Exceso", ENGINE_NAME, SymptomState.ACTIVE);
        engine.counts.add(new LevelCount(ENGINE_NAME, 3, 7));
        OffsetDateTime start = NOW.minusDays(1);
        engine.cases.addAll(List.of(
                engineCase(1, 3, start),
                engineCase(2, 3, start),
                engineCase(3, 3, start),
                engineCase(4, 4, start),
                engineCase(5, 2, start),
                engineCase(6, 3, NOW.minusMinutes(2)),
                new EngineCase(7, ENGINE_NAME, 3, "t", start, start, BigDecimal.ONE, false, true)));
        take(1, start.plusMinutes(4));
        take(1, start.plusMinutes(30));
        take(2, start.plusMinutes(10));
        take(4, start.plusMinutes(2));
        take(5, start.plusMinutes(1));

        Double sla = service().stats(TENANT).operators().slaMetLastWeek();

        // Due: 1 (met at 4 of 5 min), 2 (late), 3 (never taken), 4 (met at 2 of 2 min).
        // Left out: 5 (level 2 needs no operator), 6 (5 minutes not over yet), 7 (excluded).
        assertEquals(0.5, sla, 1e-9);
    }

    @Test
    void slaIsNullWhenNoCaseWasDue() {
        symptom("speeding", "Exceso", ENGINE_NAME, SymptomState.TEST);
        engine.counts.add(new LevelCount(ENGINE_NAME, 3, 7));
        engine.cases.add(engineCase(1, 3, NOW.minusDays(1)));
        assertNull(service().stats(TENANT).operators().slaMetLastWeek(), "TEST symptoms are not measured");
    }

    @Test
    void changesCountDraftsAndTheNewestPublication() {
        UUID first = symptom("speeding", "Exceso", ENGINE_NAME, SymptomState.ACTIVE);
        symptom("lost", "Pérdida", null, SymptomState.TEST);
        catalog.saveDraft(TENANT, OWNER, first, Specs.with(Specs.speeding(), "signal.trip.active"));
        catalog.publish(TENANT, OWNER, first, "Solo en viaje", null, null);
        catalog.saveDraft(TENANT, OWNER, first, Specs.speeding());

        SymptomStats stats = service().stats(TENANT);

        assertEquals(1, stats.changes().drafts());
        assertEquals(first, stats.changes().lastPublished().definitionId());
        assertEquals("2.0.0", stats.changes().lastPublished().version());
        assertEquals(OWNER, stats.changes().lastPublished().by());
        assertEquals("Solo en viaje", stats.changes().lastPublished().reason());
    }
}
