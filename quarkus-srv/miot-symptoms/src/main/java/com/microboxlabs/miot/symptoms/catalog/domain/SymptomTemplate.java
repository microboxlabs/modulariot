package com.microboxlabs.miot.symptoms.catalog.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.microboxlabs.miot.core.auth.PlatformScope;

/**
 * A platform template: a ready symptom an organization copies into its catalog. Templates are the published
 * symptoms of the {@value #PLATFORM_TENANT} tenant.
 *
 * @param key         stable id, also the default key of a symptom made from it
 * @param description when it opens, in words, for the template list
 * @param version     the template's version in force
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SymptomTemplate(String key, String name, String family, String icon, String description,
        String version, SymptomSpec spec) {

    /** The tenant whose symptoms are the platform templates. They are always OFF. */
    public static final String PLATFORM_TENANT = PlatformScope.TENANT;
}
