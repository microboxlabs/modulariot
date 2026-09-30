package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.SymptomDetail;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SymptomCatalogServiceTest {

    private static final String TENANT = "tenant-a";
    private static final String OWNER = "owner@example.com";

    private InMemoryCatalog catalog;
    private AuditService audit;
    private SymptomCatalogService service;

    @BeforeEach
    void setUp() {
        catalog = new InMemoryCatalog();
        catalog.upsert(Specs.gpsSignal());
        audit = new AuditService(new InMemoryAuditStore());
        service = new SymptomCatalogService(catalog, new DataSourceService(catalog, new UnavailableSymptomEngine()),
                audit);
    }

    private UUID speeding() {
        return service.create(TENANT, OWNER, new CreateRequest("speeding", "Exceso de velocidad", "driving_safety",
                "speed", null, "gps_signal", 9, Specs.speeding())).definition().id();
    }

    @Test
    void publishComputesTheVersionFromTheChange() {
        UUID id = speeding();
        assertEquals("1.0.0", service.publish(TENANT, OWNER, id, "Primera versión", null, SymptomState.ACTIVE)
                .version());

        SymptomSpec raised = Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 5",
                "medida >= 5 && medida < 11", "medida >= 11 && medida < 25", "medida >= 25 && sostenido_s >= 60"));
        service.saveDraft(TENANT, OWNER, id, raised);
        assertEquals("1.1.0", service.plan(TENANT, id).nextVersion());
        assertEquals("1.1.0", service.publish(TENANT, OWNER, id, "Umbral más alto", null, null).version());

        service.saveDraft(TENANT, OWNER, id, Specs.with(raised, Specs.ACTIVATION + " && signal.gps.speed_kmh > 10"));
        assertEquals("2.0.0", service.publish(TENANT, OWNER, id, "Nueva condición", null, null).version());

        SymptomDetail detail = service.get(TENANT, id);
        assertEquals("2.0.0", detail.definition().currentVersion());
        assertNull(detail.draft());
        assertEquals(3, detail.versions().size());
    }

    @Test
    void theOwnerCanRaiseTheBumpButNotLowerIt() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera", null, SymptomState.ACTIVE);
        service.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(), Specs.ACTIVATION + " && true"));

        assertEquals("2.0.0", service.publish(TENANT, OWNER, id, "Cambio", VersionBump.PATCH, null).version());

        SymptomSpec current = service.get(TENANT, id).current().spec();
        List<SymptomSpec.Level> slower = List.of(current.levels().get(0), current.levels().get(1),
                current.levels().get(2), new SymptomSpec.Level(4, true, current.levels().get(3).when(),
                        Specs.response(true, 1)));
        service.saveDraft(TENANT, OWNER, id, Specs.withLevels(current, slower));
        assertEquals(VersionBump.PATCH, service.plan(TENANT, id).bump());
        assertEquals("2.1.0", service.publish(TENANT, OWNER, id, "Subo el cambio", VersionBump.MINOR, null)
                .version());
    }

    @Test
    void draftsWithErrorsOrNoChangesAreNotPublished() {
        UUID id = speeding();
        service.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(), "signal.trip.activo"));
        assertThrows(IllegalStateException.class, () -> service.publish(TENANT, OWNER, id, "x", null, null));

        service.saveDraft(TENANT, OWNER, id, Specs.speeding());
        service.publish(TENANT, OWNER, id, "Primera", null, null);
        service.saveDraft(TENANT, OWNER, id, Specs.speeding());
        assertThrows(IllegalStateException.class, () -> service.publish(TENANT, OWNER, id, "Igual", null, null));
        assertThrows(IllegalArgumentException.class, () -> service.publish(TENANT, OWNER, id, " ", null, null));
    }

    @Test
    void rollbackPublishesTheOldSpecAsANewVersion() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera", null, SymptomState.ACTIVE);
        service.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(), Specs.ACTIVATION + " && true"));
        service.publish(TENANT, OWNER, id, "Segunda", null, SymptomState.ACTIVE);

        var restored = service.rollback(TENANT, OWNER, id, "1.0.0", null);

        assertEquals("3.0.0", restored.version());
        assertEquals("1.0.0", restored.rolledBackFrom());
        assertEquals(Specs.ACTIVATION, restored.spec().activation());
        assertEquals(SymptomState.ACTIVE, service.get(TENANT, id).definition().state());
        assertThrows(IllegalStateException.class, () -> service.rollback(TENANT, OWNER, id, "3.0.0", null));
    }

    @Test
    void forkStartsOffWithTheVersionAsItsDraft() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera", null, SymptomState.ACTIVE);

        SymptomDetail fork = service.fork(TENANT, OWNER, id, "1.0.0", "speeding-mine", "Exceso en faena");

        assertEquals(SymptomState.OFF, fork.definition().state());
        assertNull(fork.definition().currentVersion());
        assertNotNull(fork.definition().forkedFromVersionId());
        assertEquals(Specs.ACTIVATION, fork.draft().spec().activation());
    }

    @Test
    void engineUnsupportedFieldsCanOnlyBeTested() {
        UUID id = speeding();
        service.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(),
                Specs.ACTIVATION + " && signal.derived.speed_avg_5m > 80"));

        assertThrows(IllegalStateException.class,
                () -> service.publish(TENANT, OWNER, id, "Promedio", null, SymptomState.ACTIVE));
        assertEquals(SymptomState.TEST,
                service.publish(TENANT, OWNER, id, "Promedio", null, SymptomState.TEST) == null ? null
                        : service.get(TENANT, id).definition().state());
        assertThrows(IllegalStateException.class,
                () -> service.setState(TENANT, OWNER, id, SymptomState.ACTIVE));
    }

    @Test
    void otherTenantsCannotSeeOrChangeASymptom() {
        UUID id = speeding();

        assertThrows(NoSuchElementException.class, () -> service.get("tenant-b", id));
        SymptomSpec spec = Specs.speeding();
        assertThrows(NoSuchElementException.class, () -> service.saveDraft("tenant-b", OWNER, id, spec));
        assertTrue(service.list("tenant-b").isEmpty());
    }

    @Test
    void creatingNeedsAValidKeyAndAKnownSource() {
        CreateRequest badKey = new CreateRequest("Bad Key", "x", null, null, null, "gps_signal", null, null);
        CreateRequest unknownSource = new CreateRequest("ok-key", "x", null, null, null, "nope", null, null);
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, badKey));
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, unknownSource));
        speeding();
        assertThrows(IllegalStateException.class, this::speeding);
        assertEquals(List.of("symptom.created"), audit.list(TENANT, "symptom", null, null, null, null, 10).stream()
                .map(e -> e.action()).toList());
    }

    @Test
    void anEmptySpecMeansTheDraft() {
        UUID id = speeding();

        assertTrue(service.validate(TENANT, id, new SymptomSpec(null, null, null, null, null, null)).publishable());
    }

    @Test
    void draftSavesAreAudited() {
        UUID id = speeding();

        service.saveDraft(TENANT, OWNER, id, Specs.speeding());

        assertEquals("symptom.draft_saved", audit.list(TENANT, "symptom", null, null, null, null, 10).get(0).action());
    }
}
