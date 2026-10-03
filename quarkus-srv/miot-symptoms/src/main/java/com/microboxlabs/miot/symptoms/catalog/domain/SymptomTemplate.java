package com.microboxlabs.miot.symptoms.catalog.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * A platform template: a ready symptom an organization copies into its catalog.
 *
 * @param key         stable id, also the default key of a symptom made from it
 * @param description when it opens, in words, for the template list
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SymptomTemplate(String key, String name, String family, String icon, String description,
        SymptomSpec spec) {
}
