package com.microboxlabs.miot.symptoms.catalog.service;

import static com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate.PLATFORM_TENANT;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.store.SymptomCatalogStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** The platform templates: the published symptoms of the platform tenant, the same for every organization. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TemplateService {

    private final SymptomCatalogStore store;

    public TemplateService(SymptomCatalogStore store) {
        this.store = store;
    }

    public List<SymptomTemplate> list() {
        Map<UUID, SymptomVersion> current = store.currentVersions(PLATFORM_TENANT).stream()
                .collect(Collectors.toMap(SymptomVersion::definitionId, Function.identity()));
        return store.listDefinitions(PLATFORM_TENANT).stream()
                .filter(d -> current.containsKey(d.id()))
                .map(d -> template(d, current.get(d.id())))
                .toList();
    }

    public SymptomTemplate get(String key) {
        SymptomDefinition d = store.findDefinitionByKey(PLATFORM_TENANT, key)
                .filter(t -> t.currentVersion() != null)
                .orElseThrow(() -> new NoSuchElementException("template not found: " + key));
        SymptomVersion v = store.findVersion(PLATFORM_TENANT, d.id(), d.currentVersion())
                .orElseThrow(() -> new NoSuchElementException("template not found: " + key));
        return template(d, v);
    }

    /** The template's spec leaves the state to the copy. */
    private static SymptomTemplate template(SymptomDefinition d, SymptomVersion v) {
        return new SymptomTemplate(d.key(), d.name(), d.family(), d.icon(), d.description(), v.version(),
                v.spec().withState(null));
    }
}
