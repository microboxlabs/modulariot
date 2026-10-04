package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Report;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TemplateServiceTest {

    private final TemplateService templates = new TemplateService();

    @Test
    void everyTemplatePassesTheChecksOfItsPlatformSource() {
        DataSourceService sources = new DataSourceService(new InMemoryCatalog(), new UnavailableSymptomEngine());
        assertTrue(templates.list().size() >= 5);
        for (SymptomTemplate t : templates.list()) {
            Report report = SpecValidator.validate(t.spec(),
                    sources.find("tenant-a", t.spec().source()).orElse(null));
            assertTrue(report.publishable(), t.key() + ": " + report.findings());
        }
    }

    @Test
    void keysAreUniqueAndValidSymptomKeys() {
        Set<String> seen = new HashSet<>();
        for (SymptomTemplate t : templates.list()) {
            assertTrue(seen.add(t.key()), "duplicate " + t.key());
            assertTrue(t.key().matches("^[a-z0-9][a-z0-9_-]{1,90}$"), t.key());
            assertTrue(t.name() != null && t.family() != null && t.description() != null, t.key());
        }
    }

    @Test
    void everyTemplateFamilyIsADefaultFamily() {
        Set<String> families = new HashSet<>();
        new SymptomFamilies(tenant -> List.of()).forTenant("tenant-a").get(0).options()
                .forEach(o -> families.add(o.value()));
        for (SymptomTemplate t : templates.list()) {
            assertTrue(families.contains(t.family()), t.key() + ": " + t.family());
        }
    }

    @Test
    void anUnknownTemplateIsNotFound() {
        assertEquals("speeding", templates.get("speeding").key());
        assertThrows(NoSuchElementException.class, () -> templates.get("nope"));
    }
}
