package com.microboxlabs.miot.symptoms.catalog.service;

import static com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate.PLATFORM_TENANT;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Report;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TemplateServiceTest {

    private static final String OWNER = "owner@example.com";

    private final InMemoryCatalog store = new InMemoryCatalog();
    private final DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
    private final SymptomCatalogService catalog = new SymptomCatalogService(store, sources,
            new AuditService(new InMemoryAuditStore()));
    private final TemplateService templates = new TemplateService(store);

    @Test
    void everySeededTemplatePassesTheChecksOfItsPlatformSource() {
        assertEquals(8, SeedTemplates.all().size());
        for (SymptomTemplate t : SeedTemplates.all()) {
            Report report = SpecValidator.validate(t.spec(), sources.find(PLATFORM_TENANT, t.spec().source())
                    .orElse(null));
            assertTrue(report.publishable(), t.key() + ": " + report.findings());
        }
    }

    @Test
    void seededKeysAreUniqueAndValidSymptomKeys() {
        Set<String> seen = new HashSet<>();
        for (SymptomTemplate t : SeedTemplates.all()) {
            assertTrue(seen.add(t.key()), "duplicate " + t.key());
            assertTrue(t.key().matches("^[a-z0-9][a-z0-9_-]{1,90}$"), t.key());
            assertTrue(t.name() != null && t.family() != null && t.description() != null, t.key());
        }
    }

    @Test
    void everySeededFamilyIsADefaultFamily() {
        Set<String> families = new HashSet<>();
        new SymptomFamilies(tenant -> List.of()).forTenant("tenant-a").get(0).options()
                .forEach(o -> families.add(o.value()));
        for (SymptomTemplate t : SeedTemplates.all()) {
            assertTrue(families.contains(t.family()), t.key() + ": " + t.family());
        }
    }

    @Test
    void organizationsSeeOnlyPublishedTemplatesAtTheirVersionInForce() {
        UUID speeding = template("speeding");
        template("draft-only");
        catalog.publish(PLATFORM_TENANT, OWNER, speeding, "Primera", null, null);

        assertEquals(List.of("speeding"), templates.list().stream().map(SymptomTemplate::key).toList());
        SymptomTemplate t = templates.get("speeding");
        assertEquals("1.0.0", t.version());
        assertNull(t.spec().state(), "the copy decides its own state");
        assertThrows(NoSuchElementException.class, () -> templates.get("draft-only"));
        assertThrows(NoSuchElementException.class, () -> templates.get("nope"));
    }

    @Test
    void templatesAreAlwaysOff() {
        UUID id = template("speeding");
        catalog.publish(PLATFORM_TENANT, OWNER, id, "Primera", null, SymptomState.ACTIVE);

        assertEquals(SymptomState.OFF, catalog.get(PLATFORM_TENANT, id).definition().state());
        assertThrows(IllegalStateException.class,
                () -> catalog.setState(PLATFORM_TENANT, OWNER, id, SymptomState.TEST));
    }

    private UUID template(String key) {
        return catalog.create(PLATFORM_TENANT, OWNER, new CreateRequest(key, "Exceso", "driving_safety", null,
                "En viaje", "gps_signal", null, Specs.speeding())).definition().id();
    }
}
