package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceKind;
import com.microboxlabs.miot.symptoms.signal.SignalFields;
import java.util.List;
import java.util.UUID;

/** The GPS signal source with the fields the platform declares. */
public final class DataSourceServiceFixtures {

    private DataSourceServiceFixtures() {
    }

    public static DataSource gpsSignal() {
        return new DataSource(UUID.randomUUID(), null, DataSourceService.GPS_SIGNAL, SignalFields.name(),
                SourceKind.SIGNAL, SignalFields.ROOT, SignalFields.cadence(), SignalFields.fields(), List.of());
    }
}
