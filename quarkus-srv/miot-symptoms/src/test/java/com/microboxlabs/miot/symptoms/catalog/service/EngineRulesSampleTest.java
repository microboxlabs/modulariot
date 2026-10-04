package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.service.EngineRuleTranslator.Translation;
import com.microboxlabs.miot.symptoms.engine.EngineRule;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Every rule of a real engine configuration (rules-sample.json: patterns and
 * names only, no tenant ids) translates to a spec the validator accepts.
 */
class EngineRulesSampleTest {

    record Row(int id, String name, String trigger, Boolean active, Map<String, Object> pattern) {
    }

    @Test
    void everyEngineRuleTranslatesToAValidSpec() throws Exception {
        List<Row> rows;
        try (InputStream in = getClass().getResourceAsStream("/engine/rules-sample.json")) {
            rows = new ObjectMapper().readValue(in, new TypeReference<List<Row>>() {
            });
        }
        DataSourceService sources = new DataSourceService(new InMemoryCatalog(), new UnavailableSymptomEngine());
        List<String> failures = new ArrayList<>();
        for (Row row : rows) {
            EngineRule rule = new EngineRule(row.id(), row.name(), row.trigger(), row.pattern(),
                    Boolean.TRUE.equals(row.active()), List.of(), false);
            Translation t = EngineRuleTranslator.translate(rule);
            SpecValidator.Report report = SpecValidator.validate(t.spec(),
                    sources.find("tenant-a", t.sourceKey()).orElseThrow());
            if (!report.publishable()) {
                failures.add(row.id() + " " + row.name() + ": " + report.findings());
            }
        }
        assertEquals(29, rows.size());
        assertTrue(failures.isEmpty(), () -> String.join("\n", failures));
    }
}
