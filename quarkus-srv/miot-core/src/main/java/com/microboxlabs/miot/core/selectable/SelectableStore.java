package com.microboxlabs.miot.core.selectable;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/** Option lists, and which form field uses which list. */
public interface SelectableStore {

    /** Ordered by creation. */
    List<Selectable> list(String tenantCode);

    Optional<Selectable> find(String tenantCode, String key);

    /** Creates or replaces by key; stamps {@code updatedAt}. */
    Selectable upsert(Selectable selectable);

    /** Also drops every binding that pointed at the deleted list. */
    boolean delete(String tenantCode, String key);

    Map<String, String> bindings(String tenantCode);

    /**
     * Sets every binding or none. A binding to a list that does not exist is an
     * {@link IllegalArgumentException}.
     */
    void bindAll(String tenantCode, Map<String, String> fieldToSelectable);

    /**
     * Writes each list of {@code defaults} whose key the tenant was never given, and records the key. A key is
     * given once: deleting its list does not bring it back. A list the tenant already has under that key is kept.
     * All or nothing.
     */
    void seed(String tenantCode, List<Selectable> defaults);

    /**
     * Replaces every list and binding of the tenant with {@code lists}, and records their keys as given. All or
     * nothing.
     */
    void resetTo(String tenantCode, List<Selectable> lists);

    /**
     * Runs {@code work} holding the tenant's write lock, which every replica
     * sharing the store waits on. Not reentrant: {@code work} must not call it.
     */
    <T> T locked(String tenantCode, Supplier<T> work);
}
