package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.TemplateService;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EvaluatorStreamTest {

    private static final String DEMO = "tenant-demo";
    private static final String OTHER = "tenant-other";

    private final List<Transition> recorded = new ArrayList<>();
    private SymptomCatalogService catalog;
    private EvaluatorCatalog evaluatorCatalog;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        DataSourceService sources = new DataSourceService(store, new UnavailableSymptomEngine());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        evaluatorCatalog = new EvaluatorCatalog(catalog, sources);
        publishPanic(DEMO, SymptomState.TEST);
        publishPanic(OTHER, SymptomState.TEST);
    }

    private void publishPanic(String tenant, SymptomState state) {
        var id = catalog.create(tenant, "owner@example.com", new CreateRequest("panic-button", "Botón de pánico",
                null, null, null, "gps_signal", null, new TemplateService().get("panic-button").spec()))
                .definition().id();
        catalog.publish(tenant, "owner@example.com", id, "Primera versión", null, state);
    }

    private EvaluatorStream stream(Set<String> tenants) {
        return new EvaluatorStream(true, tenants, evaluatorCatalog, (tenant, t) -> recorded.addAll(t),
                new SimpleMeterRegistry(), Clock.systemUTC(), new InMemoryEpisodeRepository());
    }

    private static String signal(String at, Boolean panic, String... clients) {
        String sensors = panic == null ? "{}" : "{\"panic_button\":" + panic + "}";
        return """
                {"schema":"miot.gps.signal@1","asset_id":"DEMO01","at":"%s","clients":[%s],
                 "trip":{"active":false,"double_driver":false},
                 "gps":{"speed_kmh":0.0,"engine_on":true,"moving":false},"local_hour":9,
                 "frame":{"asset_id":"DEMO01","sensors":%s}}
                """.formatted(at, String.join(",", List.of(clients).stream().map(c -> "\"" + c + "\"").toList()),
                sensors);
    }

    @Test
    void aPanicPressOpensOneCaseForTheAllowedOrganization() {
        EvaluatorStream s = stream(Set.of(DEMO));

        assertEquals(0, s.evaluate(signal("2026-10-22T03:00:00Z", false, DEMO)));
        assertEquals(1, s.evaluate(signal("2026-10-22T03:00:30Z", true, DEMO, OTHER)));
        assertEquals(0, s.evaluate(signal("2026-10-22T03:01:00Z", true, DEMO)), "still pressed: same case");
        assertEquals(0, s.evaluate(signal("2026-10-22T03:01:30Z", null, DEMO)), "no button field: no rule error");

        assertEquals(1, recorded.size());
        Transition opened = recorded.get(0);
        assertEquals(Kind.OPENED, opened.kind());
        assertEquals(4, opened.level());
        assertEquals(SymptomState.TEST, opened.state());
        assertEquals("DEMO01", opened.assetId());
    }

    @Test
    void organizationsOutsideTheListAndOldSignalsAreIgnored() {
        EvaluatorStream s = stream(Set.of(DEMO));

        assertEquals(0, s.evaluate(signal("2026-10-22T03:00:30Z", true, OTHER)));
        assertEquals(1, s.evaluate(signal("2026-10-22T03:00:30Z", true, DEMO)));
        assertEquals(0, s.evaluate(signal("2026-10-22T03:00:00Z", true, DEMO)), "older than the last applied");
    }

    @Test
    void doesNothingWhenOffOrWithoutOrganizations() {
        EvaluatorStream off = new EvaluatorStream(false, Set.of(DEMO), evaluatorCatalog, (t, x) -> recorded.addAll(x),
                new SimpleMeterRegistry(), Clock.systemUTC(), new InMemoryEpisodeRepository());

        assertEquals(0, off.evaluate(signal("2026-10-22T03:00:30Z", true, DEMO)));
        assertEquals(0, stream(Set.of()).evaluate(signal("2026-10-22T03:00:30Z", true, DEMO)));
    }

    @Test
    void episodesSurviveARoundTripThroughJson() {
        Episode e = new Episode(java.util.UUID.randomUUID(), "1.0.0", "DEMO01",
                java.time.Instant.parse("2026-10-22T03:00:00Z"), null, null,
                java.util.Map.of(4, java.time.Instant.parse("2026-10-22T03:00:00Z")),
                java.time.Instant.parse("2026-10-22T03:00:30Z"), java.time.Instant.parse("2026-10-22T03:00:30Z"),
                4, 0);

        assertEquals(e, RedisEpisodes.read(RedisEpisodes.write(e)));
    }
}
