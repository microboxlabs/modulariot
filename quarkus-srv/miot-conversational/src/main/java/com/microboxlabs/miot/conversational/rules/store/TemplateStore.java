package com.microboxlabs.miot.conversational.rules.store;

import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import java.util.List;
import java.util.Optional;

/** The tenant's message templates, by key. */
public interface TemplateStore {

    /** Ordered by key. */
    List<ConvTemplate> list(String tenantCode);

    Optional<ConvTemplate> find(String tenantCode, String key);

    /**
     * Creates or replaces the template with this tenant and key, keeping the id and creation time, provided the
     * stored one is still at {@code expectedVersion} (null: there is none); empty when another save got there
     * first.
     */
    Optional<ConvTemplate> upsert(ConvTemplate template, String expectedVersion);
}
