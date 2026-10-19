package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.service.EngineRuleTranslator.Translation;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.SymptomSummary;
import com.microboxlabs.miot.symptoms.engine.EngineRule;
import com.microboxlabs.miot.symptoms.engine.SymptomEngine;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Creates a symptom for each engine rule the organization does not have yet,
 * as an unpublished draft that is off. The owner reviews each one, fixes what
 * the translation could not say, and publishes it.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class EngineImportService {

    private final SymptomEngine engine;
    private final SymptomCatalogService catalog;

    public EngineImportService(SymptomEngine engine, SymptomCatalogService catalog) {
        this.engine = engine;
        this.catalog = catalog;
    }

    /** One imported rule and what its translation left for the owner. */
    public record Imported(String id, String name, int engineRuleId, List<String> pending) {
    }

    public record ImportResult(List<Imported> created, int skipped) {
    }

    public ImportResult importRules(String tenantCode, String actor) {
        if (!engine.available()) {
            throw new IllegalStateException("the symptom engine is not connected");
        }
        Set<Integer> known = catalog.list(tenantCode).stream()
                .map(SymptomSummary::definition)
                .map(SymptomDefinition::engineRuleId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        List<Imported> created = new ArrayList<>();
        int skipped = 0;
        for (EngineRule rule : engine.rules(tenantCode)) {
            if (known.contains(rule.id())) {
                skipped++;
                continue;
            }
            Translation t = EngineRuleTranslator.translate(rule);
            SymptomDefinition d = catalog.create(tenantCode, actor, new CreateRequest(t.key(), t.name(), null, t.icon(),
                    description(rule, t), t.sourceKey(), rule.id(), t.spec())).definition();
            created.add(new Imported(d.id().toString(), d.name(), rule.id(), t.pending()));
        }
        return new ImportResult(created, skipped);
    }

    private static String description(EngineRule rule, Translation t) {
        String base = "Importado de la regla " + rule.id() + " del motor" + (rule.active() ? "" : " (inactiva)") + ".";
        return t.pending().isEmpty() ? base : base + " Por traducir: " + String.join("; ", t.pending()) + ".";
    }
}
