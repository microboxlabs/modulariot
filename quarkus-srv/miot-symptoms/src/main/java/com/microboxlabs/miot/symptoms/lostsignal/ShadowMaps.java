package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.function.Supplier;

/** The shadow map this replica reads, built from the coverage job's rows of the window and reloaded by its owner. */
public class ShadowMaps implements Supplier<ShadowMap> {

    private final CoverageStore store;
    private final CoverageSettings settings;
    private final Clock clock;
    private volatile ShadowMap map = ShadowMap.empty();

    /** @param store null keeps the map empty */
    public ShadowMaps(CoverageStore store, CoverageSettings settings, Clock clock) {
        this.store = store;
        this.settings = settings;
        this.clock = clock;
    }

    /** A fixed map, for tests. */
    public static ShadowMaps of(ShadowMap map) {
        ShadowMaps m = new ShadowMaps(null, CoverageSettings.defaults(), Clock.systemUTC());
        m.map = map;
        return m;
    }

    @Override
    public ShadowMap get() {
        return map;
    }

    /** Reads the window's rows and replaces the map; returns its cells. */
    public int reload() {
        if (store == null) {
            return map.cells();
        }
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        LocalDate first = today.minusDays(settings.window());
        ShadowMap built = ShadowMap.build(store.cells(first), store.senders(first), today, settings);
        map = built;
        return built.cells();
    }
}
