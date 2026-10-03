package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceKind;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.IdentityRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.PublishPlan;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.SymptomDetail;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
    void aForkOfAPublishedVersionStartsInTestAtZeroOneZeroAndSaysWhereItCameFrom() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera", null, SymptomState.ACTIVE);

        SymptomDetail fork = service.fork(TENANT, OWNER, id, "1.0.0", "speeding-mine", "Exceso en faena");

        assertEquals(SymptomState.TEST, fork.definition().state(), "the source was ACTIVE; a copy starts in test");
        assertEquals("0.1.0", fork.definition().currentVersion());
        assertNull(fork.draft());
        assertEquals(SymptomState.TEST, fork.current().spec().state());
        assertEquals("Copia de Exceso de velocidad 1.0.0", fork.current().reason());
        assertEquals(Specs.ACTIVATION, fork.current().spec().activation());
        assertNotNull(fork.definition().forkedFromVersionId());
        assertEquals(new SymptomCatalogService.ForkedFrom(id, "Exceso de velocidad", "1.0.0"), fork.forkedFrom());
        assertNull(service.get(TENANT, id).forkedFrom(), "the source is not a copy");
    }

    @Test
    void aForkOfANeverPublishedSymptomIsADraft() {
        UUID id = speeding();
        SymptomDetail fork = service.fork(TENANT, OWNER, id, null, "speeding-draft", "Borrador copiado");
        assertEquals(SymptomState.OFF, fork.definition().state());
        assertNull(fork.definition().currentVersion());
        assertEquals(Specs.ACTIVATION, fork.draft().spec().activation());
        assertNull(fork.definition().forkedFromVersionId(), "a draft is no stable source");
        assertNull(fork.forkedFrom());
        service.publish(TENANT, OWNER, id, "Primera", null, SymptomState.TEST);
        assertNull(service.get(TENANT, fork.definition().id()).forkedFrom(), "publishing the source changes nothing");
    }

    @Test
    void aForkThatCannotBePublishedLeavesNothingBehind() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera", null, SymptomState.TEST);
        catalog.upsert(new DataSource(UUID.randomUUID(), null, "gps_signal", "Señal GPS", SourceKind.SIGNAL,
                "signal", "Cada pulso", List.of(), List.of()));

        assertThrows(IllegalStateException.class,
                () -> service.fork(TENANT, OWNER, id, "1.0.0", "speeding-copy", "Copia"));
        assertEquals(1, service.list(TENANT).size());
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
    void aTemplateStartsInTestAtZeroOneZero() {
        SymptomTemplate template = new SymptomTemplate("speeding", "Exceso de velocidad", "Seguridad de conducción",
                "SPEED LIMIT STANDARD", "En viaje y sobre el límite", Specs.speeding());

        SymptomDetail first = service.createFromTemplate(TENANT, OWNER, template, null);
        SymptomDetail second = service.createFromTemplate(TENANT, OWNER, template, "Exceso en ruta 5");

        assertEquals("0.1.0", first.definition().currentVersion());
        assertEquals(SymptomState.TEST, first.definition().state());
        assertEquals("speeding", first.definition().templateKey());
        assertEquals("Exceso de velocidad", first.definition().name());
        assertNull(first.draft(), "the template is published, not left as a draft");
        assertEquals("speeding-2", second.definition().key());
        assertEquals("Exceso en ruta 5", second.definition().name());

        UUID id = first.definition().id();
        service.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(), Specs.ACTIVATION + " && true"));
        assertEquals("1.0.0", service.publish(TENANT, OWNER, id, "Nueva condición", null, null).version());
    }

    private static SymptomTemplate speedingTemplate() {
        return new SymptomTemplate("speeding", "Exceso de velocidad", "Seguridad de conducción",
                "SPEED LIMIT STANDARD", "En viaje y sobre el límite", Specs.speeding());
    }

    @Test
    void aTemplateThatDoesNotFitTheSourceLeavesNothingBehind() {
        SymptomTemplate template = new SymptomTemplate("speeding", "Exceso de velocidad", "Seguridad de conducción",
                null, "En viaje", Specs.with(Specs.speeding(), "signal.gps.not_in_this_source > 1"));

        assertThrows(IllegalStateException.class, () -> service.createFromTemplate(TENANT, OWNER, template, null));

        assertTrue(service.list(TENANT).isEmpty(), "no definition and no draft were written");
        assertEquals("speeding", service.createFromTemplate(TENANT, OWNER, speedingTemplate(), null).definition()
                .key(), "the key is still free");
    }

    @Test
    void aTemplateCopyRacingAnotherForTheSameKeyTakesTheNextOne() {
        InMemoryCatalog racing = new InMemoryCatalog() {
            private boolean raced;

            @Override
            public SymptomDefinition insertDefinition(SymptomDefinition d) {
                if (!raced && d.key().equals("speeding")) {
                    raced = true;
                    super.insertDefinition(new SymptomDefinition(UUID.randomUUID(), d.tenantCode(), "speeding",
                            "Ganó la otra", null, null, null, "gps_signal", null, null, null, SymptomState.OFF, null,
                            OWNER, d.createdAt(), OWNER, d.createdAt()));
                }
                return super.insertDefinition(d);
            }
        };
        racing.upsert(Specs.gpsSignal());
        SymptomCatalogService raced = new SymptomCatalogService(racing,
                new DataSourceService(racing, new UnavailableSymptomEngine()), audit);

        assertEquals("speeding-2", raced.createFromTemplate(TENANT, OWNER, speedingTemplate(), null).definition()
                .key());
    }

    @Test
    void lengthsCountCharactersNotUtf16Units() {
        String emoji = "\uD83D\uDE9A";
        CreateRequest fits = new CreateRequest("emoji", emoji.repeat(200), null, null, null, "gps_signal", null, null);
        assertEquals(emoji.repeat(200), service.create(TENANT, OWNER, fits).definition().name());
        CreateRequest tooLong = new CreateRequest("emoji-2", emoji.repeat(201), null, null, null, "gps_signal", null,
                null);
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, tooLong));
    }

    private static SymptomSpec withFamilyAndState(SymptomSpec s, String family, SymptomState state) {
        return new SymptomSpec(s.source(), s.activation(), s.measure(), s.levels(), s.lifecycle(), s.recurrence(),
                family, state);
    }

    @Test
    void stateAndFamilyInTheDraftArePatchChangesAppliedOnPublish() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera versión", null, SymptomState.ACTIVE);

        service.saveDraft(TENANT, OWNER, id, withFamilyAndState(Specs.speeding(), "zones_places", SymptomState.TEST));
        PublishPlan plan = service.plan(TENANT, id);
        assertEquals(VersionBump.PATCH, plan.bump());
        assertEquals(List.of("Cambió la familia", "Estado: Activo → En prueba"),
                plan.changes().stream().map(SpecDiff.Change::text).toList());

        SymptomVersion v = service.publish(TENANT, OWNER, id, "A prueba", null, null);
        assertEquals("1.0.1", v.version());
        SymptomDefinition d = service.get(TENANT, id).definition();
        assertEquals(SymptomState.TEST, d.state());
        assertEquals("zones_places", d.family());
        assertEquals(SymptomState.TEST, v.spec().state(), "the version records the state it set");
        assertEquals("zones_places", v.spec().family());
    }

    @Test
    void aDraftThatLeavesStateAndFamilyKeepsTheSymptoms() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera versión", null, SymptomState.ACTIVE);
        service.saveDraft(TENANT, OWNER, id, Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 6",
                "medida >= 6 && medida < 11", "medida >= 11 && medida < 21", "medida >= 21 && sostenido_s >= 60")));

        assertTrue(service.plan(TENANT, id).changes().stream().allMatch(c -> c.section().equals("levels")));
        service.publish(TENANT, OWNER, id, "Umbral", null, null);

        SymptomDefinition d = service.get(TENANT, id).definition();
        assertEquals(SymptomState.ACTIVE, d.state(), "publishing keeps the state in force");
        assertEquals("driving_safety", d.family());
    }

    @Test
    void aDraftCannotBeActiveWithFieldsTheEngineLacks() {
        UUID id = speeding();
        SymptomSpec unsupported = withFamilyAndState(
                Specs.with(Specs.speeding(), Specs.ACTIVATION + " && signal.derived.speed_avg_5m > 10"), null,
                SymptomState.ACTIVE);
        service.saveDraft(TENANT, OWNER, id, unsupported);

        assertFalse(service.validate(TENANT, id, null).publishable());
        assertTrue(service.validate(TENANT, id, null).findings().stream().anyMatch(f -> f.section().equals("state")));
        assertThrows(IllegalStateException.class, () -> service.publish(TENANT, OWNER, id, "x", null, null));

        service.saveDraft(TENANT, OWNER, id, withFamilyAndState(unsupported, null, SymptomState.TEST));
        assertEquals(SymptomState.TEST, service.publish(TENANT, OWNER, id, "En prueba", null, null).spec().state());
    }

    @Test
    void anExplicitStateIsPartOfThePlan() {
        UUID id = speeding();
        SymptomSpec unsupported = withFamilyAndState(
                Specs.with(Specs.speeding(), Specs.ACTIVATION + " && signal.derived.speed_avg_5m > 10"), null,
                SymptomState.ACTIVE);
        service.saveDraft(TENANT, OWNER, id, unsupported);

        SymptomVersion v = service.publish(TENANT, OWNER, id, "En prueba", null, SymptomState.TEST);

        assertEquals(SymptomState.TEST, v.spec().state());
        assertEquals(SymptomState.TEST, service.get(TENANT, id).definition().state());
    }

    @Test
    void comparingAVersionPublishedBeforeFamilyAndStateShowsNoSuchChange() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera versión", null, SymptomState.ACTIVE);
        SymptomDefinition d = service.get(TENANT, id).definition();
        OffsetDateTime at = OffsetDateTime.now(ZoneOffset.UTC);
        catalog.publish(SymptomVersion.draft(id, TENANT, Specs.speeding(), OWNER, at)
                .published("0.9.0", VersionBump.MAJOR, "Antes de familia y estado", null, OWNER, at), d);

        assertTrue(service.compare(TENANT, id, "0.9.0", "1.0.0").isEmpty());
    }

    @Test
    void aFamilyLongerThanItsColumnIsAnErrorInTheDraft() {
        UUID id = speeding();
        service.saveDraft(TENANT, OWNER, id, withFamilyAndState(Specs.speeding(), "f".repeat(97), null));

        assertTrue(service.validate(TENANT, id, null).findings().stream().anyMatch(f -> f.section().equals("family")));
        assertThrows(IllegalStateException.class, () -> service.publish(TENANT, OWNER, id, "x", null, null));
    }

    @Test
    void rollingBackRestoresTheRulesNotTheState() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera versión", null, SymptomState.ACTIVE);
        SymptomSpec raised = Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 6",
                "medida >= 6 && medida < 11", "medida >= 11 && medida < 21", "medida >= 21 && sostenido_s >= 60"));
        service.saveDraft(TENANT, OWNER, id, withFamilyAndState(raised, null, SymptomState.TEST));
        service.publish(TENANT, OWNER, id, "A prueba con otro umbral", null, null);

        SymptomVersion back = service.rollback(TENANT, OWNER, id, "1.0.0", null);
        assertEquals(Specs.speeding().levels(), back.spec().levels());

        assertEquals(SymptomState.TEST, back.spec().state());
        assertEquals(SymptomState.TEST, service.get(TENANT, id).definition().state());
    }

    @Test
    void reorderingTheActivationsConditionsIsNoChange() {
        UUID id = speeding();
        service.publish(TENANT, OWNER, id, "Primera", null, SymptomState.ACTIVE);
        service.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(),
                "signal.vehicle.weight_category == \"HEAVY\" && signal.trip.active"));
        assertTrue(service.plan(TENANT, id).changes().isEmpty());
        assertThrows(IllegalStateException.class, () -> service.publish(TENANT, OWNER, id, "Orden", null, null));

        service.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(),
                "(signal.vehicle.weight_category == \"HEAVY\" && (signal.trip.active))"));
        assertTrue(service.plan(TENANT, id).changes().isEmpty(), "parentheses are no change");

        service.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(),
                "signal.vehicle.weight_category == \"HEAVY\" || signal.trip.active"));
        assertEquals(VersionBump.MAJOR, service.plan(TENANT, id).bump(), "|| instead of &&: a real change");
    }

    @Test
    void theListCarriesTheSpecInForceNotTheDraft() {
        UUID id = speeding();
        assertNull(service.list(TENANT).get(0).current(), "nothing published yet");

        service.publish(TENANT, OWNER, id, "Primera", null, SymptomState.ACTIVE);
        service.saveDraft(TENANT, OWNER, id, Specs.with(Specs.speeding(), Specs.ACTIVATION + " && true"));

        var summary = service.list(TENANT).get(0);
        assertTrue(summary.hasDraft());
        assertEquals(Specs.ACTIVATION, summary.current().spec().activation());
        assertEquals("Primera", summary.current().reason());
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
    void namesFamiliesAndIconsLongerThanTheirColumnsAreRejected() {
        String longName = "x".repeat(201);
        CreateRequest tooLong = new CreateRequest("ok-key", longName, null, null, null, "gps_signal", null, null);
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, tooLong));
        UUID id = speeding();
        IdentityRequest family = new IdentityRequest(null, "f".repeat(97), null, null);
        IdentityRequest icon = new IdentityRequest(null, null, "i".repeat(65), null);
        assertThrows(IllegalArgumentException.class, () -> service.updateIdentity(TENANT, OWNER, id, family));
        assertThrows(IllegalArgumentException.class, () -> service.updateIdentity(TENANT, OWNER, id, icon));
        assertEquals("x".repeat(200), service.updateIdentity(TENANT, OWNER, id,
                new IdentityRequest("x".repeat(200), null, null, null)).name());
    }

    @Test
    void anEmptySpecMeansTheDraft() {
        UUID id = speeding();

        assertTrue(service.validate(TENANT, id, new SymptomSpec(null, null, null, null, null, null)).publishable());
    }

    @Test
    void theResponseOfALiveCaseComesFromTheVersionInForce() {
        UUID id = speeding();
        assertThrows(NoSuchElementException.class, () -> service.responseFor(TENANT, "speed", 4), "off: nothing");

        service.publish(TENANT, OWNER, id, "Primera", null, SymptomState.ACTIVE);

        var response = service.responseFor(TENANT, "SPEED", 4);
        assertEquals("1.0.0", response.version());
        assertEquals(2, response.level().response().slaMinutes());
        assertThrows(NoSuchElementException.class, () -> service.responseFor(TENANT, "other", 4));
        assertThrows(NoSuchElementException.class, () -> service.responseFor(TENANT, "speed", 5), "no such level");

        service.fork(TENANT, OWNER, id, "1.0.0", "speeding-copy", "Copia");
        assertEquals(id, service.responseFor(TENANT, "speed", 4).definitionId(), "the active one wins over a test copy");
        assertThrows(NoSuchElementException.class, () -> service.responseFor("tenant-b", "speed", 4));
    }

    @Test
    void draftSavesAreAudited() {
        UUID id = speeding();

        service.saveDraft(TENANT, OWNER, id, Specs.speeding());

        assertEquals("symptom.draft_saved", audit.list(TENANT, "symptom", null, null, null, null, 10).get(0).action());
    }
}
