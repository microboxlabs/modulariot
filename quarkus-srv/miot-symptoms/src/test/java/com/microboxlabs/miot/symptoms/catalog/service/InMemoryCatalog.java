package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionStatus;
import com.microboxlabs.miot.symptoms.catalog.store.DataSourceStore;
import com.microboxlabs.miot.symptoms.catalog.store.SymptomCatalogStore;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** In-memory catalog and source stores for service tests, with the same rules as the Postgres ones. */
public class InMemoryCatalog implements SymptomCatalogStore, DataSourceStore {

    private final Map<UUID, SymptomDefinition> definitions = new LinkedHashMap<>();
    private final Map<UUID, SymptomVersion> versions = new LinkedHashMap<>();
    private final Map<String, DataSource> sources = new LinkedHashMap<>();

    @Override
    public List<SymptomDefinition> listDefinitions(String tenantCode) {
        return definitions.values().stream().filter(d -> d.tenantCode().equals(tenantCode)).toList();
    }

    @Override
    public Optional<SymptomDefinition> findDefinition(String tenantCode, UUID id) {
        return Optional.ofNullable(definitions.get(id)).filter(d -> d.tenantCode().equals(tenantCode));
    }

    @Override
    public Optional<SymptomDefinition> findDefinitionByKey(String tenantCode, String key) {
        return listDefinitions(tenantCode).stream().filter(d -> d.key().equals(key)).findFirst();
    }

    @Override
    public SymptomDefinition insertDefinition(SymptomDefinition definition) {
        definitions.put(definition.id(), definition);
        return definition;
    }

    @Override
    public SymptomDefinition updateDefinition(SymptomDefinition definition) {
        if (findDefinition(definition.tenantCode(), definition.id()).isEmpty()) {
            throw new NoSuchElementException("Symptom not found: " + definition.id());
        }
        definitions.put(definition.id(), definition);
        return definition;
    }

    @Override
    public List<SymptomVersion> listVersions(String tenantCode, UUID definitionId) {
        List<SymptomVersion> out = new ArrayList<>(versions.values().stream()
                .filter(v -> v.tenantCode().equals(tenantCode) && v.definitionId().equals(definitionId)).toList());
        out.sort(Comparator.comparing(SymptomVersion::createdAt).reversed());
        return out;
    }

    @Override
    public Optional<SymptomVersion> findDraft(String tenantCode, UUID definitionId) {
        return listVersions(tenantCode, definitionId).stream().filter(v -> v.status() == VersionStatus.DRAFT)
                .findFirst();
    }

    @Override
    public Optional<SymptomVersion> findVersion(String tenantCode, UUID definitionId, String version) {
        return listVersions(tenantCode, definitionId).stream().filter(v -> version.equals(v.version())).findFirst();
    }

    @Override
    public SymptomVersion saveDraft(SymptomVersion draft) {
        findDefinition(draft.tenantCode(), draft.definitionId()).orElseThrow();
        Optional<SymptomVersion> existing = findDraft(draft.tenantCode(), draft.definitionId());
        SymptomVersion saved = existing.map(e -> e.withSpec(draft.spec())).orElse(draft);
        versions.put(saved.id(), saved);
        return saved;
    }

    @Override
    public Set<UUID> definitionsWithDraft(String tenantCode) {
        Set<UUID> ids = new HashSet<>();
        versions.values().stream()
                .filter(v -> v.tenantCode().equals(tenantCode) && v.status() == VersionStatus.DRAFT)
                .forEach(v -> ids.add(v.definitionId()));
        return ids;
    }

    @Override
    public void deleteDraft(String tenantCode, UUID definitionId) {
        findDraft(tenantCode, definitionId).ifPresent(d -> versions.remove(d.id()));
    }

    @Override
    public SymptomVersion publish(SymptomVersion version, SymptomDefinition definition) {
        SymptomVersion existing = versions.get(version.id());
        if (existing != null && existing.status() == VersionStatus.PUBLISHED) {
            throw new IllegalStateException("version already published: " + version.id());
        }
        versions.put(version.id(), version);
        updateDefinition(definition);
        return version;
    }

    @Override
    public List<DataSource> list(String tenantCode) {
        return List.copyOf(sources.values());
    }

    @Override
    public Optional<DataSource> find(String tenantCode, String key) {
        return Optional.ofNullable(sources.get(key));
    }

    @Override
    public DataSource upsert(DataSource source) {
        sources.put(source.key(), source);
        return source;
    }
}
