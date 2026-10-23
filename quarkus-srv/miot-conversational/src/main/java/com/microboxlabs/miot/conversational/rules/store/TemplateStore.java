package com.microboxlabs.miot.conversational.rules.store;

import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import java.util.List;
import java.util.Optional;

/** The tenant's message templates, by key. */
public interface TemplateStore {

    /** Ordered by key. */
    List<ConvTemplate> list(String tenantCode);

    Optional<ConvTemplate> find(String tenantCode, String key);

    /** Creates or replaces the template with this tenant and key; keeps the id and creation time. */
    ConvTemplate upsert(ConvTemplate template);
}
