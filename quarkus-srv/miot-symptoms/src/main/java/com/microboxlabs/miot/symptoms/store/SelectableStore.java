package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.Selectable;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Option lists behind the treatment forms, and which form field uses which list. */
public interface SelectableStore {

    /** Ordered by creation. */
    List<Selectable> list(String tenantCode);

    Optional<Selectable> find(String tenantCode, String key);

    /** Creates or replaces by key; stamps {@code updatedAt}. */
    Selectable upsert(Selectable selectable);

    boolean delete(String tenantCode, String key);

    /** Removes every selectable and binding of the tenant. */
    void clear(String tenantCode);

    Map<String, String> bindings(String tenantCode);

    void bind(String tenantCode, String fieldKey, String selectableKey);
}
