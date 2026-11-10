package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.store.ExternalEventStore;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** {@link ExternalEventStore} in memory. */
final class InMemoryExternalEvents implements ExternalEventStore {

    final List<ExternalEventType> rows = new ArrayList<>();

    @Override
    public synchronized List<ExternalEventType> list(String tenantCode) {
        return rows.stream().filter(t -> tenantCode.equals(t.tenantCode()))
                .sorted(Comparator.comparing(ExternalEventType::type)).toList();
    }

    @Override
    public synchronized void replace(String tenantCode, String source, List<ExternalEventType> types) {
        rows.removeIf(t -> tenantCode.equals(t.tenantCode())
                && (source.equals(t.source()) || types.stream().anyMatch(n -> n.type().equals(t.type()))));
        rows.addAll(types);
    }
}
