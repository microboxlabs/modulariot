package com.microboxlabs.miot.conversational.rules.store;

import com.microboxlabs.miot.conversational.rules.ExternalEventType;
import java.util.List;

/** The event types external producers declared, per organization. */
public interface ExternalEventStore {

    /** The organization's declared types, by type. */
    List<ExternalEventType> list(String tenantCode);

    /** Replaces the types {@code source} declared for the organization with {@code types}, all of that source. */
    void replace(String tenantCode, String source, List<ExternalEventType> types);
}
