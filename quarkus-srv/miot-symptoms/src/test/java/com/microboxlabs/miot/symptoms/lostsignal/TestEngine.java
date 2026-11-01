package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorCatalog;
import com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeRepository;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/** The catalog, transition log, events and audit a detector test runs its trip checks against, in memory. */
public final class TestEngine {

    public final InMemoryCatalog store = new InMemoryCatalog();
    public final DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
    public final InMemoryAuditStore audits = new InMemoryAuditStore();
    public final SymptomCatalogService catalog = new SymptomCatalogService(store, sources, new AuditService(audits));
    public final List<OperationalEvent> fired = new ArrayList<>();
    public final List<Transition> recorded = new ArrayList<>();
    public final SymptomEvents events;
    private final Map<String, Long> opened = new HashMap<>();

    public TestEngine(Clock clock) {
        events = new SymptomEvents(e -> {
            fired.add(e);
            return CompletableFuture.completedFuture(e);
        }, store::findDefinition, clock);
    }

    /** As {@code PgTransitionLog}: ids from 1, each change's case is its OPENED row. */
    public final TransitionLog log = (tenant, transitions, place) -> {
        List<TransitionLog.Recorded> out = new ArrayList<>();
        for (Transition t : transitions) {
            recorded.add(t);
            String k = tenant + "/" + t.definitionId() + "/" + t.assetId();
            if (t.kind() == Transition.Kind.OPENED) {
                opened.put(k, (long) recorded.size());
            }
            out.add(new TransitionLog.Recorded(t, opened.get(k)));
        }
        return out;
    };

    public TripChecks trips(MeterRegistry meters) {
        return new TripChecks(new EvaluatorCatalog(catalog, sources), new InMemoryEpisodeRepository(), log, events,
                new AuditService(audits), meters);
    }

    public UUID publish(String tenant, String key, SymptomSpec spec, SymptomState state) {
        UUID id = catalog.create(tenant, "owner@example.com", new CreateRequest(key, key, null, null, null,
                spec.source(), null, spec)).definition().id();
        catalog.publish(tenant, "owner@example.com", id, "Primera versión", null, state);
        return id;
    }

    public List<String> types() {
        return fired.stream().map(OperationalEvent::type).toList();
    }
}
