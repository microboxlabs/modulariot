package com.microboxlabs.miot.symptoms.catalog.store;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import java.util.List;
import java.util.Optional;

/** Data sources rules read: the platform's, plus an organization's own. */
public interface DataSourceStore {

    /** Platform sources and the organization's, the organization's replacing a platform one with the same key. */
    List<DataSource> list(String tenantCode);

    Optional<DataSource> find(String tenantCode, String key);

    DataSource upsert(DataSource source);
}
