package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.RulesFixture.PANIC_SPEC;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.T0;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.TENANT;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.event;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.panic;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** What the Activity list shows about each run's context. */
class RunsServiceTest {

    private final RulesFixture f = new RulesFixture();

    @Test
    void aSymptomCaseRunCarriesTheSymptomAndTheAssetOthersDoNot() {
        Rule rule = f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        Run symptomRun = f.engine.accept(event("symptom.case.opened", "-3", panic(4), false)).get(0);

        StoredEvent serviceEvent = new StoredEvent(RulesFixture.id(), TENANT, "service.created", "miot-services",
                "service", "SVC-1", Map.of("symptomName", "Botón de pánico", "assetId", "ABCD12"), false, T0, T0);
        f.store.events.put(serviceEvent.id(), serviceEvent);
        Run serviceRun = new Run(RulesFixture.id(), TENANT, rule.id(), "0.1.0", serviceEvent.id(), "service", "SVC-1",
                false, Run.Status.DONE, 2, null, null, T0.minusSeconds(60), T0);
        f.store.runs.put(serviceRun.id(), serviceRun);

        List<RunsService.RunView> views = f.runs.list(TENANT, null, null, null);

        RunsService.RunView symptom = views.stream().filter(v -> v.id().equals(symptomRun.id())).findFirst()
                .orElseThrow();
        assertEquals("-3", symptom.contextKey());
        assertEquals("Botón de pánico", symptom.symptomName());
        assertEquals("ABCD12", symptom.assetId());

        RunsService.RunView service = views.stream().filter(v -> v.id().equals(serviceRun.id())).findFirst()
                .orElseThrow();
        assertNull(service.symptomName());
        assertNull(service.assetId());
    }
}
