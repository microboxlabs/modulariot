package com.microboxlabs.miot.conversational.rules.store;

import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** The message templates of a tenant, by key: the platform's, or an organization's own. */
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

    /** Deletes the tenant's template; false when there was none. */
    boolean delete(String tenantCode, String key);

    /** The template a rule of {@code tenantCode} sends: the organization's own, else the platform's. */
    default Optional<ConvTemplate> resolve(String tenantCode, String key) {
        if (key == null) {
            return Optional.empty();
        }
        Optional<ConvTemplate> own = ConvTemplate.PLATFORM_TENANT.equals(tenantCode) || tenantCode == null
                ? Optional.empty() : find(tenantCode, key);
        return own.isPresent() ? own : find(ConvTemplate.PLATFORM_TENANT, key);
    }

    /** The templates the rules of {@code tenantCode} can use, by key: its own replace the platform's. */
    default List<ConvTemplate> visible(String tenantCode) {
        Map<String, ConvTemplate> byKey = new LinkedHashMap<>();
        list(ConvTemplate.PLATFORM_TENANT).forEach(t -> byKey.put(t.key(), t));
        if (tenantCode != null && !ConvTemplate.PLATFORM_TENANT.equals(tenantCode)) {
            list(tenantCode).forEach(t -> byKey.put(t.key(), t));
        }
        List<ConvTemplate> out = new ArrayList<>(byKey.values());
        out.sort((a, b) -> a.key().compareTo(b.key()));
        return out;
    }
}
