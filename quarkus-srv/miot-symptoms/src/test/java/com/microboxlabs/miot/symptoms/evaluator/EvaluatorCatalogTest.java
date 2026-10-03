package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorCatalog.Versions;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EvaluatorCatalogTest {

    private static final String TENANT = "tenant-a";
    private static final String OWNER = "owner@example.com";

    private InMemoryCatalog store;
    private SymptomCatalogService catalog;
    private EvaluatorCatalog evaluatorCatalog;

    @BeforeEach
    void setUp() {
        store = new InMemoryCatalog();
        store.upsert(Specs.gpsSignal());
        DataSourceService sources = new DataSourceService(store, new UnavailableSymptomEngine());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        evaluatorCatalog = new EvaluatorCatalog(catalog, sources);
    }

    private UUID published(String key, SymptomState state) {
        UUID id = catalog.create(TENANT, OWNER, new CreateRequest(key, key, null, null, null, "gps_signal", null,
                Specs.speeding())).definition().id();
        catalog.publish(TENANT, OWNER, id, "Primera versión", null, state);
        return id;
    }

    private static List<UUID> ids(Versions v) {
        return v.symptoms().stream().map(CompiledSymptom::definitionId).toList();
    }

    @Test
    void runsTheVersionInForceOfActiveAndTestSymptomsOfTheSource() {
        UUID active = published("active", SymptomState.ACTIVE);
        UUID test = published("test", SymptomState.TEST);
        published("off", SymptomState.OFF);
        catalog.create(TENANT, OWNER, new CreateRequest("draft-only", "x", null, null, null, "gps_signal", null,
                Specs.speeding()));

        Versions v = evaluatorCatalog.forSource(TENANT, "gps_signal");

        assertEquals(List.of(active, test), ids(v));
        assertEquals(List.of(SymptomState.ACTIVE, SymptomState.TEST),
                v.symptoms().stream().map(CompiledSymptom::state).toList());
        assertTrue(evaluatorCatalog.forSource(TENANT, "trip_check").symptoms().isEmpty(), "another source");
        assertTrue(evaluatorCatalog.forSource("tenant-b", "gps_signal").symptoms().isEmpty(), "another tenant");
        assertTrue(evaluatorCatalog.forSource(TENANT, "nope").symptoms().isEmpty(), "no such source");
    }

    @Test
    void aVersionIsCompiledOnceAndAgainWhenANewOneIsPublished() {
        UUID id = published("speeding", SymptomState.ACTIVE);
        CompiledSymptom first = evaluatorCatalog.forSource(TENANT, "gps_signal").symptoms().get(0);
        assertSame(first.activation(), evaluatorCatalog.forSource(TENANT, "gps_signal").symptoms().get(0)
                .activation(), "the same compiled rules");

        catalog.setState(TENANT, OWNER, id, SymptomState.TEST);
        CompiledSymptom switched = evaluatorCatalog.forSource(TENANT, "gps_signal").symptoms().get(0);
        assertEquals(SymptomState.TEST, switched.state());
        assertSame(first.activation(), switched.activation(), "a state switch does not compile again");

        catalog.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(), "signal.trip.active"));
        catalog.publish(TENANT, OWNER, id, "Solo en viaje", null, null);
        CompiledSymptom next = evaluatorCatalog.forSource(TENANT, "gps_signal").symptoms().get(0);
        assertEquals("2.0.0", next.version());
        assertNotSame(first.activation(), next.activation());
        assertEquals(1, evaluatorCatalog.cached(), "one entry per symptom");
    }

    @Test
    void aVersionReadingAFieldTheEngineLacksRunsInTestButNotActive() {
        UUID id = published("speeding", SymptomState.ACTIVE);
        DataSource gps = Specs.gpsSignal();
        store.upsert(new DataSource(gps.id(), gps.tenantCode(), gps.key(), gps.name(), gps.kind(), gps.root(),
                gps.cadence(), gps.fields().stream()
                        .map(f -> f.path().equals("signal.gps.speed_kmh") ? new SourceField(f.path(), f.label(),
                                f.type(), f.unit(), f.origin(), false) : f)
                        .toList(), gps.samples()));

        Versions active = evaluatorCatalog.forSource(TENANT, "gps_signal");
        assertTrue(active.symptoms().isEmpty());
        assertEquals(EvaluatorCatalog.ACTIVE_NEEDS_ENGINE, active.skipped().get(0).reason());

        catalog.setState(TENANT, OWNER, id, SymptomState.TEST);
        Versions test = evaluatorCatalog.forSource(TENANT, "gps_signal");
        assertEquals(List.of(id), ids(test), "the version was published ACTIVE; its current state is what counts");
        assertTrue(test.skipped().isEmpty());
    }

    @Test
    void aVersionThatNoLongerFitsItsSourceIsSkipped() {
        UUID id = published("speeding", SymptomState.ACTIVE);
        DataSource gps = Specs.gpsSignal();
        store.upsert(new DataSource(gps.id(), gps.tenantCode(), gps.key(), gps.name(), gps.kind(), gps.root(),
                gps.cadence(), gps.fields().stream().filter(f -> !f.path().equals("signal.road.maxspeed_osm"))
                        .toList(), gps.samples()));

        Versions v = evaluatorCatalog.forSource(TENANT, "gps_signal");

        assertTrue(v.symptoms().isEmpty());
        assertEquals(List.of(id), v.skipped().stream().map(EvaluatorCatalog.Skipped::definitionId).toList());
        assertEquals("1.0.0", v.skipped().get(0).version());
    }
}
