package com.microboxlabs.miot.core.selectable;

import java.util.List;
import java.util.Map;

/**
 * A {@link SelectableSource.Kind#SYSTEM} source that can list every option at
 * once; search, parent filter and limit are applied here. A source over a large
 * table should implement {@link SelectableOptionSource} and filter in its query
 * instead.
 */
public abstract class ListedSystemSource implements SelectableOptionSource {

    private final String id;
    private final Map<String, String> label;
    private final Map<String, String> description;

    protected ListedSystemSource(String id, Map<String, String> label, Map<String, String> description) {
        this.id = id;
        this.label = label;
        this.description = description;
    }

    /** Every option this source has for the tenant. */
    protected abstract List<SelectableOption> all(String tenantCode);

    @Override
    public final SelectableSource.Kind kind() {
        return SelectableSource.Kind.SYSTEM;
    }

    @Override
    public final String id() {
        return id;
    }

    @Override
    public List<Descriptor> describe(String tenantCode) {
        return List.of(new Descriptor(SelectableSource.Kind.SYSTEM, id, label, description));
    }

    @Override
    public List<SelectableOption> options(String tenantCode, SelectableSource source, Query query) {
        String needle = SelectableService.fold(query.search());
        return all(tenantCode).stream()
                .filter(o -> query.parents().isEmpty() || query.parents().contains(o.parent()))
                .filter(o -> needle.isEmpty() || SelectableService.matches(o, needle))
                .limit(query.limit())
                .toList();
    }
}
