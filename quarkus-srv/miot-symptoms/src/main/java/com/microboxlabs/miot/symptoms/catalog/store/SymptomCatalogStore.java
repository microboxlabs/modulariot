package com.microboxlabs.miot.symptoms.catalog.store;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Symptom definitions and their versions, per organization. */
public interface SymptomCatalogStore {

    List<SymptomDefinition> listDefinitions(String tenantCode);

    Optional<SymptomDefinition> findDefinition(String tenantCode, UUID id);

    Optional<SymptomDefinition> findDefinitionByKey(String tenantCode, String key);

    SymptomDefinition insertDefinition(SymptomDefinition definition);

    SymptomDefinition updateDefinition(SymptomDefinition definition);

    /** Every version of a symptom, the draft included, newest first. */
    List<SymptomVersion> listVersions(String tenantCode, UUID definitionId);

    Optional<SymptomVersion> findDraft(String tenantCode, UUID definitionId);

    /** Ids of the organization's symptoms that have a draft, in one query. */
    Set<UUID> definitionsWithDraft(String tenantCode);

    /** The version in force of each of the organization's published symptoms, in one query. */
    List<SymptomVersion> currentVersions(String tenantCode);

    Optional<SymptomVersion> findVersion(String tenantCode, UUID definitionId, String version);

    /** A version by its id, whatever symptom of the tenant it belongs to. */
    Optional<SymptomVersion> findVersionById(String tenantCode, UUID versionId);

    /** Creates the symptom's draft, or replaces its spec. */
    SymptomVersion saveDraft(SymptomVersion draft);

    void deleteDraft(String tenantCode, UUID definitionId);

    /**
     * Stores a published version (the former draft, or a new row for a
     * rollback) and saves the definition pointing at it, together.
     */
    SymptomVersion publish(SymptomVersion version, SymptomDefinition definition);
}
