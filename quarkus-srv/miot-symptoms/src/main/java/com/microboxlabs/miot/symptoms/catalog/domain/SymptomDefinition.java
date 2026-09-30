package com.microboxlabs.miot.symptoms.catalog.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One symptom of one organization. Its rules are in {@link SymptomVersion}s;
 * {@code currentVersion} is the published version in force, or null.
 *
 * @param family              a {@code symptom_families} selectable value
 * @param engineRuleId        the GPS engine rule it mirrors, or null
 * @param templateKey         the platform template it was created from, or null
 * @param forkedFromVersionId the version it was duplicated from, or null
 */
public record SymptomDefinition(
        UUID id,
        String tenantCode,
        String key,
        String name,
        String family,
        String icon,
        String description,
        String sourceKey,
        Integer engineRuleId,
        String templateKey,
        UUID forkedFromVersionId,
        SymptomState state,
        String currentVersion,
        String createdBy,
        OffsetDateTime createdAt,
        String updatedBy,
        OffsetDateTime updatedAt) {

    public SymptomDefinition withCurrent(String version, SymptomState nextState, String actor, OffsetDateTime at) {
        return new SymptomDefinition(id, tenantCode, key, name, family, icon, description, sourceKey, engineRuleId,
                templateKey, forkedFromVersionId, nextState, version, createdBy, createdAt, actor, at);
    }
}
