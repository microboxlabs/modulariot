package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.service.RuleDescriptionService.Caller;
import com.microboxlabs.miot.symptoms.catalog.service.RuleDescriptionService.Description;
import com.microboxlabs.miot.symptoms.catalog.service.RuleDescriptionService.UnavailableException;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RuleDescriptionServiceTest {

    private static final String TENANT = "tenant-a";
    private static final Caller CALLER = new Caller("Bearer t", "client-a", "owner@example.com");

    private InMemoryRuleDescriptions store;
    private DataSourceService sources;
    private final List<Map<String, Object>> calls = new ArrayList<>();
    private String answer;

    @BeforeEach
    void setUp() {
        store = new InMemoryRuleDescriptions();
        sources = new DataSourceService(new InMemoryCatalog(), new UnavailableSymptomEngine());
        answer = "Se activa cuando el camión está <b>en viaje</b>.";
        calls.clear();
    }

    private RuleDescriptionService service() {
        return new RuleDescriptionService(store, sources, (caller, body) -> {
            assertEquals(CALLER, caller);
            calls.add(body);
            return answer;
        });
    }

    @Test
    void writesOnceAndServesSpacingChangesFromTheCache() {
        RuleDescriptionService service = service();

        Description first = service.describe(TENANT, "activation", "signal.trip.active", "gps_signal", null, CALLER);
        Description second = service.describe(TENANT, "activation", "  signal.trip.active\n", "gps_signal", "es-CL",
                CALLER);

        assertFalse(first.cached());
        assertTrue(second.cached());
        assertEquals(first.html(), second.html());
        assertEquals(1, calls.size());
        assertEquals(1, store.size());
    }

    @Test
    void eachDistinctRuleSectionOrLocaleCallsTheHarness() {
        RuleDescriptionService service = service();

        service.describe(TENANT, "activation", "signal.trip.active", "gps_signal", null, CALLER);
        service.describe(TENANT, "activation", "!signal.trip.active", "gps_signal", null, CALLER);
        service.describe(TENANT, "measure", "signal.trip.active", "gps_signal", null, CALLER);
        service.describe(TENANT, "activation", "signal.trip.active", "gps_signal", "en-US", CALLER);

        assertEquals(4, calls.size());
    }

    @Test
    void sendsTheSourceLabelsAndTheSectionVariables() {
        RuleDescriptionService service = service();

        service.describe(TENANT, "activation", "signal.trip.active", "gps_signal", null, CALLER);
        service.describe(TENANT, "levels.2", "medida >= 11 && sostenido_s > 60", "gps_signal", null, CALLER);
        service.describe(TENANT, "lifecycle.close", "caso.normal_s >= 120", "gps_signal", null, CALLER);

        Map<?, ?> activation = (Map<?, ?>) calls.get(0).get("fields");
        assertEquals("En viaje", activation.get("signal.trip.active"));
        assertFalse(activation.containsKey("medida"));
        assertEquals("es-CL", calls.get(0).get("locale"));

        Map<?, ?> level = (Map<?, ?>) calls.get(1).get("fields");
        assertEquals("valor medido", level.get("medida"));
        assertTrue(level.containsKey("sostenido_s"));

        Map<?, ?> lifecycle = (Map<?, ?>) calls.get(2).get("fields");
        assertTrue(lifecycle.containsKey("caso.normal_s"));
        assertFalse(lifecycle.containsKey("signal.trip.active"));
    }

    @Test
    void sanitizesTheHarnessAnswerBeforeSaving() {
        answer = "<b onclick=\"x()\">a</b> <script>alert(1)</script> <i>b</i> <mark>c";
        RuleDescriptionService service = service();

        String html = service.describe(TENANT, "activation", "signal.trip.active", "gps_signal", null, CALLER)
                .html();

        assertEquals("&lt;b onclick=\"x()\"&gt;a &lt;script&gt;alert(1)&lt;/script&gt; <i>b</i> <mark>c</mark>",
                html);
        assertEquals(html, service.describe(TENANT, "activation", "signal.trip.active", "gps_signal", null, CALLER)
                .html());
    }

    @Test
    void sanitizingTwiceChangesNothingAndLengthIsCapped() {
        String once = DescriptionHtml.sanitize("a &lt;b&gt; & <b>c</b>");
        assertEquals("a &lt;b&gt; &amp; <b>c</b>", once);
        assertEquals(once, DescriptionHtml.sanitize(once));
        assertEquals("<b>" + "x".repeat(DescriptionHtml.MAX_CHARS) + "</b>",
                DescriptionHtml.sanitize("<b>" + "x".repeat(1000) + "</b>"));
    }

    @Test
    void anUnavailableHarnessIsReportedAndNothingIsSaved() {
        RuleDescriptionService down = new RuleDescriptionService(store, sources, (caller, body) -> {
            throw new IllegalStateException("connection refused");
        });
        RuleDescriptionService empty = new RuleDescriptionService(store, sources, (caller, body) -> "  ");

        assertThrows(UnavailableException.class,
                () -> down.describe(TENANT, "activation", "signal.trip.active", "gps_signal", null, CALLER));
        assertThrows(UnavailableException.class,
                () -> empty.describe(TENANT, "activation", "signal.trip.active", "gps_signal", null, CALLER));
        assertEquals(0, store.size());
    }

    @Test
    void badInputIsRefused() {
        RuleDescriptionService service = service();

        assertThrows(IllegalArgumentException.class,
                () -> service.describe(TENANT, "levels.5", "medida > 1", "gps_signal", null, CALLER));
        assertThrows(IllegalArgumentException.class,
                () -> service.describe(TENANT, "activation", " ", "gps_signal", null, CALLER));
        assertThrows(IllegalArgumentException.class,
                () -> service.describe(TENANT, "activation", "x".repeat(4001), "gps_signal", null, CALLER));
        assertThrows(IllegalArgumentException.class,
                () -> service.describe(TENANT, "activation", "true", "gps_signal", "<script>", CALLER));
        assertThrows(NoSuchElementException.class,
                () -> service.describe(TENANT, "activation", "true", "missing", null, CALLER));
        assertEquals(0, calls.size());
    }
}
