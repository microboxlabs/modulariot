package com.microboxlabs.miot.core.selectable;

import java.util.List;
import java.util.Map;

/**
 * Fetches the options of a list whose source is not static. Implement it as a
 * CDI bean. A {@link SelectableSource.Kind#SYSTEM} bean serves one source,
 * named by {@link #id()}, such as a component's vehicles; the
 * {@link SelectableSource.Kind#CONNECTION} bean serves every connection.
 *
 * <p>Called on a worker thread, so it may block.
 */
public interface SelectableOptionSource {

    SelectableSource.Kind kind();

    /** The {@link SelectableSource#ref()} a list names to use this source; ignored for CONNECTION. */
    String id();

    /** What an editor may pick for this tenant: this source, or one entry per usable connection. */
    List<Descriptor> describe(String tenantCode);

    /** At most {@code query.limit()} options matching the query. */
    List<SelectableOption> options(String tenantCode, SelectableSource source, Query query);

    /**
     * @param search  text to match against value and label, or blank for all
     * @param parents values selected in the {@code dependsOn} list; empty means no filter
     */
    record Query(String search, List<String> parents, int limit) {
    }

    record Descriptor(SelectableSource.Kind kind, String ref, Map<String, String> label,
            Map<String, String> description) {
    }
}
