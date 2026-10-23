package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.InMemoryEngineCases;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomStatsService.PerSymptom;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomStatsService.SymptomStats;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService.SettingsRequest;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTowerSettingsStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SymptomStatsServiceTest {

    private static final String TENANT = "tenant-a";
    private static final String OWNER = "owner@example.com";
    private static final OffsetDateTime NOW = OffsetDateTime.of(2026, 10, 2, 12, 0, 0, 0, ZoneOffset.UTC);

    private SymptomCatalogService catalog;
    private InMemoryTreatmentStore treatments;
    private TowerSettingsService settings;
    private InMemoryEngineCases cases;
    private long nextId;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        store.upsert(Specs.gpsSignal());
        catalog = new SymptomCatalogService(store, new DataSourceService(store, SignalSamples.inMemory()),
                new AuditService(new InMemoryAuditStore()));
        treatments = new InMemoryTreatmentStore();
        settings = new TowerSettingsService(new InMemoryTowerSettingsStore(), new AuditService(new InMemoryAuditStore()));
        cases = new InMemoryEngineCases();
        nextId = 1;
    }

    private SymptomStatsService service() {
        return new SymptomStatsService(catalog, cases, treatments, settings, () -> NOW);
    }

    private UUID symptom(String key, String name, SymptomState state) {
        UUID id = catalog.create(TENANT, OWNER, new CreateRequest(key, name, null, null, null, "gps_signal", null,
                Specs.speeding())).definition().id();
        catalog.publish(TENANT, OWNER, id, "Primera versión de " + key, null, state);
        return id;
    }

    /** Adds {@code n} cases of the symptom at the level, opened at {@code at}; returns the last case's id. */
    private long add(UUID definition, int level, Integer slaMinutes, OffsetDateTime at, int n) {
        Instant opened = at.toInstant();
        for (int i = 0; i < n; i++) {
            cases.add(new EngineCase(nextId++, definition, "1.0.0", "Exceso", "speed", "A-1", opened, level, null,
                    null, null, null, null, 0, slaMinutes, null));
        }
        return nextId - 1;
    }

    private long add(UUID definition, int level, OffsetDateTime at, int n) {
        return add(definition, level, null, at, n);
    }

    private void take(long caseId, OffsetDateTime at) {
        treatments.insert(new Treatment(null, TENANT, -caseId, "asset", "trip", TreatmentType.CALL,
                TreatmentStatus.OPEN, "ops@example.com", at, null, null, null, null, null));
    }

    @Test
    void withoutTheCasesOnlyTheCatalogNumbersAreReturned() {
        cases.down = true;
        symptom("speeding", "Exceso", SymptomState.ACTIVE);
        SymptomStats stats = service().stats(TENANT);
        assertFalse(stats.engineAvailable());
        assertEquals(List.of(0L, 0L, 0L, 0L), stats.totals().weekByLevel());
        assertNull(stats.totals().topShare());
        assertEquals(8, stats.operators().shiftHours());
        assertNull(stats.operators().slaMetLastWeek());
        assertEquals("Exceso", stats.changes().lastPublished().name());
    }

    @Test
    void noCasesAreZerosOverAWeek() {
        symptom("speeding", "Exceso", SymptomState.ACTIVE);
        SymptomStats stats = service().stats(TENANT);
        assertTrue(stats.engineAvailable());
        assertEquals(7, stats.windowDays());
        assertEquals(0, stats.totals().week());
        assertNull(stats.totals().topShare());
    }

    @Test
    void casesAreWeeklyAveragesPerDefinitionOverNinetyDays() {
        UUID active = symptom("speeding", "Exceso", SymptomState.ACTIVE);
        UUID test = symptom("speeding-copy", "Exceso", SymptomState.TEST);
        OffsetDateTime at = NOW.minusDays(10);
        add(active, 2, at, 180);
        add(active, 3, at, 90);
        add(active, 4, at, 270);
        add(active, 5, at, 9);
        add(test, 1, at, 90);
        add(active, 4, NOW.minusDays(120), 1);

        SymptomStats stats = service().stats(TENANT);

        assertTrue(stats.engineAvailable());
        assertEquals(90, stats.windowDays());
        PerSymptom a = stats.symptoms().stream().filter(p -> p.definitionId().equals(active)).findFirst().orElseThrow();
        assertEquals(List.of(0L, 14L, 7L, 21L), a.weekByLevel());
        assertEquals(42, a.week());
        assertEquals(28, a.operatorWeek(), "levels 3 and 4 need an operator");
        assertEquals(List.of(7L, 14L, 7L, 21L), stats.totals().weekByLevel(), "level 5 and old cases are left out");
        assertEquals(49, stats.totals().week());
        assertEquals(1, stats.totals().perShift(), "28 a week over 21 eight-hour shifts");
        assertEquals(List.of(active, test), stats.totals().topShare().definitionIds());
        assertEquals(1.0, stats.totals().topShare().share(), 1e-9);
    }

    @Test
    void aShortHistoryIsAveragedOverTheDaysSinceTheFirstCase() {
        UUID id = symptom("speeding", "Exceso", SymptomState.ACTIVE);
        add(id, 4, NOW.minusDays(14), 10);
        SymptomStats stats = service().stats(TENANT);
        assertEquals(14, stats.windowDays());
        assertEquals(5, stats.totals().week());

        cases = new InMemoryEngineCases();
        add(id, 4, NOW.minusDays(2), 3);
        stats = service().stats(TENANT);
        assertEquals(7, stats.windowDays(), "never less than a week");
        assertEquals(3, stats.totals().week());
    }

    @Test
    void operatorLoadCountsActiveSymptomsOnlyAndFollowsTheShiftLength() {
        UUID id = symptom("speeding", "Exceso", SymptomState.TEST);
        add(id, 4, NOW.minusDays(5), 900);
        add(id, 1, NOW.minusDays(95), 1);
        assertEquals(0, service().stats(TENANT).totals().perShift(), "a TEST symptom asks no operator");

        catalog.setState(TENANT, OWNER, id, SymptomState.ACTIVE);
        settings.save(TENANT, OWNER, new SettingsRequest(3, 12, 150));
        SymptomStats stats = service().stats(TENANT);
        assertEquals(5, stats.totals().perShift(), "70 a week over 14 twelve-hour shifts");
        assertEquals(3, stats.operators().operators());
        assertEquals(150, stats.operators().capacityPerShift());
        assertEquals(12, stats.operators().shiftHours());
    }

    @Test
    void slaMetCountsCasesTakenWithinTheLevelSlaOnceTheSlaRanOut() {
        UUID active = symptom("speeding", "Exceso", SymptomState.ACTIVE);
        UUID test = symptom("speeding-test", "Exceso", SymptomState.TEST);
        OffsetDateTime start = NOW.minusDays(1);
        long one = add(active, 3, 5, start, 1);
        long two = add(active, 3, 5, start, 1);
        add(active, 3, 5, start, 1);
        long four = add(active, 4, 2, start, 1);
        long five = add(active, 2, null, start, 1);
        add(active, 3, 5, NOW.minusMinutes(2), 1);
        long seven = add(test, 3, 5, start, 1);
        add(active, 3, 5, NOW.minusDays(8), 1);
        take(one, start.plusMinutes(4));
        take(one, start.plusMinutes(30));
        take(two, start.plusMinutes(10));
        take(four, start.plusMinutes(2));
        take(five, start.plusMinutes(1));
        take(seven, start.plusMinutes(1));

        Double sla = service().stats(TENANT).operators().slaMetLastWeek();

        // Due: 1 (met at 4 of 5 min), 2 (late), 3 (never taken), 4 (met at 2 of 2 min).
        // Left out: 5 (no SLA), 6 (5 minutes not over yet), 7 (TEST symptom), 8 (older than a week).
        assertEquals(0.5, sla, 1e-9);
    }

    @Test
    void slaRunsFromWhenTheCaseReachedItsLevel() {
        UUID id = symptom("speeding", "Exceso", SymptomState.ACTIVE);
        OffsetDateTime opened = NOW.minusDays(1);
        long escalated = add(id, 4, 5, opened, 1);
        cases.levelSince.put(escalated, opened.plusHours(1).toInstant());
        take(escalated, opened.plusHours(1).plusMinutes(2));

        assertEquals(1.0, service().stats(TENANT).operators().slaMetLastWeek(), 1e-9,
                "taken 2 minutes after the escalation, within its 5 minutes");
    }

    @Test
    void theBusiestDefinitionsAreRankedByCasesNotRoundedAverages() {
        UUID a = symptom("speeding", "Exceso", SymptomState.ACTIVE);
        UUID b = symptom("speeding-b", "Exceso B", SymptomState.ACTIVE);
        UUID c = symptom("speeding-c", "Exceso C", SymptomState.ACTIVE);
        UUID e = symptom("speeding-d", "Exceso D", SymptomState.ACTIVE);
        OffsetDateTime at = NOW.minusDays(89);
        add(a, 1, at, 5);
        add(b, 1, at, 5);
        add(c, 1, at, 6);
        add(e, 1, at, 5);

        SymptomStats stats = service().stats(TENANT);

        assertEquals(0, stats.symptoms().get(0).week(), "5 cases in 90 days round to 0 a week");
        assertEquals(c, stats.totals().topShare().definitionIds().get(0));
        assertEquals(3, stats.totals().topShare().definitionIds().size());
        assertEquals(16.0 / 21, stats.totals().topShare().share(), 1e-9);
    }

    @Test
    void slaReadsEveryCaseOfTheWeekPageByPage() {
        UUID id = symptom("speeding", "Exceso", SymptomState.ACTIVE);
        OffsetDateTime start = NOW.minusDays(2);
        int total = SymptomStatsService.SLA_PAGE * 2 + 1;
        add(id, 3, 5, start, total);
        for (long caseId = 2; caseId <= total; caseId += 2) {
            take(caseId, start.plusMinutes(1));
        }

        Double sla = service().stats(TENANT).operators().slaMetLastWeek();

        assertEquals((double) (total / 2) / total, sla, 1e-9);
        assertEquals(3, cases.pages, "three pages of " + SymptomStatsService.SLA_PAGE);
    }

    @Test
    void slaIsNullWhenNoCaseWasDue() {
        UUID id = symptom("speeding", "Exceso", SymptomState.TEST);
        add(id, 3, 5, NOW.minusDays(1), 1);
        assertNull(service().stats(TENANT).operators().slaMetLastWeek(), "TEST symptoms are not measured");
    }

    @Test
    void theWindowRoundsPartDaysUp() {
        Instant now = NOW.toInstant();
        Instant from = now.minus(Duration.ofDays(90));
        assertEquals(8, SymptomStatsService.windowDays(now.minus(Duration.ofHours(7 * 24 + 1)), from, now));
        assertEquals(90, SymptomStatsService.windowDays(from.minusSeconds(1), from, now));
    }

    @Test
    void changesCountDraftsAndTheNewestPublication() {
        UUID first = symptom("speeding", "Exceso", SymptomState.ACTIVE);
        symptom("lost", "Pérdida", SymptomState.TEST);
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
