package com.microboxlabs.miot.core.selectable;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Option lists, and which form field uses which list. */
public interface SelectableStore {

    /** Ordered by creation. */
    List<Selectable> list(String tenantCode);

    Optional<Selectable> find(String tenantCode, String key);

    /** Creates or replaces by key; stamps {@code updatedAt}. */
    Selectable upsert(Selectable selectable);

    /** Also drops every binding that pointed at the deleted list. */
    boolean delete(String tenantCode, String key);

    /** Removes every selectable and binding of the tenant. */
    void clear(String tenantCode);

    Map<String, String> bindings(String tenantCode);

    void bind(String tenantCode, String fieldKey, String selectableKey);
}
