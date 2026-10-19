package com.microboxlabs.miot.symptoms.catalog.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * The rules of a symptom at one point. A DRAFT has no version number;
 * publishing gives it one and it is never edited again.
 *
 * @param rolledBackFrom the version whose spec this one restores, or null
 */
public record SymptomVersion(
        UUID id,
        UUID definitionId,
        String tenantCode,
        String version,
        VersionStatus status,
        SymptomSpec spec,
        VersionBump bump,
        String reason,
        String rolledBackFrom,
        String createdBy,
        OffsetDateTime createdAt,
        String publishedBy,
        OffsetDateTime publishedAt) {

    public static SymptomVersion draft(UUID definitionId, String tenantCode, SymptomSpec spec, String actor,
            OffsetDateTime at) {
        return new SymptomVersion(UUID.randomUUID(), definitionId, tenantCode, null, VersionStatus.DRAFT, spec, null,
                null, null, actor, at, null, null);
    }

    public SymptomVersion withSpec(SymptomSpec next) {
        return new SymptomVersion(id, definitionId, tenantCode, version, status, next, bump, reason, rolledBackFrom,
                createdBy, createdAt, publishedBy, publishedAt);
    }

    public SymptomVersion published(String number, VersionBump appliedBump, String why, String restoredFrom,
            String actor, OffsetDateTime at) {
        return new SymptomVersion(id, definitionId, tenantCode, number, VersionStatus.PUBLISHED, spec, appliedBump,
                why, restoredFrom, createdBy, createdAt, actor, at);
    }
}
