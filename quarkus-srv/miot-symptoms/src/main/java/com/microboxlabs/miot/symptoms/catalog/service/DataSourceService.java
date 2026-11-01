package com.microboxlabs.miot.symptoms.catalog.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceKind;
import com.microboxlabs.miot.symptoms.catalog.store.DataSourceStore;
import com.microboxlabs.miot.symptoms.signal.SignalFields;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.signal.TripCheck;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

/**
 * The data sources rules read. The GPS signal's and the trip check's fields
 * are read from their contracts ({@link SignalFields}, {@link TripCheck}); the
 * other platform sources come from
 * {@value #RESOURCE}. Both are written to the store the first time they are
 * needed. The GPS signal's samples are the organization's recent signals
 * ({@link SignalSamples}), or else fixed ones with the signal's whole shape.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class DataSourceService {

    static final String RESOURCE = "/symptoms/platform-sources.json";
    static final String GPS_SIGNAL = "gps_signal";
    private static final int RECENT_SAMPLES = 5;

    private static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private final DataSourceStore store;
    private final SignalSamples samples;
    private volatile boolean seeded;

    /** A platform source as the resource file writes it. */
    record Seed(String key, String name, SourceKind kind, String root, String cadence, List<SourceField> fields,
            List<Map<String, Object>> samples) {
    }

    public DataSourceService(DataSourceStore store, SignalSamples samples) {
        this.store = store;
        this.samples = samples;
    }

    public List<DataSource> list(String tenantCode) {
        seed();
        return store.list(tenantCode);
    }

    /** The source as stored, without the organization's recent signals. */
    public Optional<DataSource> find(String tenantCode, String key) {
        seed();
        return key == null ? Optional.empty() : store.find(tenantCode, key);
    }

    /** The source, with the organization's recent signals as the GPS signal's samples when there are any. */
    public DataSource get(String tenantCode, String key) {
        seed();
        DataSource source = store.find(tenantCode, key)
                .orElseThrow(() -> new NoSuchElementException("data source not found: " + key));
        if (!GPS_SIGNAL.equals(source.key())) {
            return source;
        }
        List<Map<String, Object>> live = samples.recent(tenantCode, RECENT_SAMPLES);
        return live.isEmpty() ? source : new DataSource(source.id(), source.tenantCode(), source.key(),
                source.name(), source.kind(), source.root(), source.cadence(), source.fields(), live);
    }

    private void seed() {
        if (seeded) {
            return;
        }
        synchronized (this) {
            if (!seeded) {
                for (Seed s : read()) {
                    store.upsert(new DataSource(UUID.randomUUID(), null, s.key(), s.name(), s.kind(), s.root(),
                            s.cadence(), s.fields(), s.samples() == null ? List.of() : s.samples()));
                }
                seeded = true;
            }
        }
    }

    static List<Seed> read() {
        try (InputStream in = DataSourceService.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("missing " + RESOURCE);
            }
            List<Seed> seeds = new ArrayList<>();
            seeds.add(new Seed(GPS_SIGNAL, SignalFields.name(), SourceKind.SIGNAL, SignalFields.ROOT,
                    SignalFields.cadence(), SignalFields.fields(), SignalSamples.fallback()));
            seeds.addAll(JSON.readValue(in, new TypeReference<List<Seed>>() {
            }));
            seeds.add(new Seed(TripCheck.KEY, TripCheck.name(), SourceKind.CHECK, TripCheck.ROOT,
                    SignalFields.cadence(TripCheck.class), SignalFields.fields(TripCheck.class, TripCheck.ROOT),
                    TripCheck.samples()));
            return seeds;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
