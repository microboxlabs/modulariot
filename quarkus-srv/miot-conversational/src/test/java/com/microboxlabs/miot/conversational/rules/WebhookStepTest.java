package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.RulesFixture.T0;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.TENANT;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.event;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.panic;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** A webhook step calls its connection once per run, with the event and the template's texts. */
class WebhookStepTest {

    private static final String HOOK_SPEC = """
            {"trigger": {"event": "symptom.case.opened"},
             "audience": [{"role": "driver"}],
             "steps": [
               {"channel": "webhook", "connection": "conn-9", "template": "panic-tower"},
               {"channel": "webhook", "connection": "conn-9"}
             ]}
            """;

    private final RulesFixture f = new RulesFixture();

    private Run run() {
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));
        f.engine.runDue();
        assertEquals(1, f.store.runs.size());
        return f.store.runs.values().iterator().next();
    }

    @Test
    void eachStepCallsTheConnectionOnceWhoeverTheAudienceIs() {
        Rule rule = f.rule("hook", HOOK_SPEC, Rule.State.ACTIVE);

        Run run = run();

        assertEquals(Run.Status.DONE, run.status());
        assertNull(run.lastError());
        List<InMemoryIntegrations.Call> calls = f.integrations.calls;
        assertEquals(2, calls.size());
        InMemoryIntegrations.Call first = calls.get(0);
        assertEquals(TENANT, first.tenantCode());
        assertEquals("conn-9", first.connectionId());
        assertEquals("deliver", first.operation());
        Map<String, Object> body = first.body();
        assertEquals("symptom.case.opened", body.get("event"));
        assertEquals(T0.toString(), body.get("at"));
        assertEquals(Map.of("id", rule.id(), "key", "hook", "name", "Regla hook", "version", "0.1.0"),
                body.get("rule"));
        assertEquals(Map.of("id", run.id(), "step", 0, "test", false), body.get("run"));
        assertEquals("Pánico en ABCD12 (Código negro)", body.get("title"));
        assertEquals("El conductor no respondió. Ubicación: -33.45679, -70.64827.", body.get("text"));
        assertEquals(4, ((Map<?, ?>) body.get("data")).get("level"));

        Map<String, Object> second = calls.get(1).body();
        assertEquals(1, ((Map<?, ?>) second.get("run")).get("step"));
        assertNull(second.get("title"));
        assertNull(second.get("text"));

        assertTrue(f.whatsappSent.isEmpty());
        assertTrue(f.store.conversations.messages.isEmpty(), "webhook calls are not inbox messages");
    }

    @Test
    void aRefusedOrFailedCallIsAProblemOnTheRunAndTheRunGoesOn() {
        f.rule("hook", HOOK_SPEC, Rule.State.ACTIVE);
        f.integrations.answer = new OperationInvocationResult(500, "boom");

        Run refused = run();

        assertEquals(Run.Status.DONE, refused.status());
        assertEquals("webhook conn-9: HTTP 500: boom", refused.lastError());
        assertEquals(2, f.integrations.calls.size());

        f.store.runs.clear();
        f.integrations.answer = null;
        assertEquals("webhook conn-9: connection refused", run().lastError());
    }

    @Test
    void aTestRunCallsNothing() {
        f.rule("hook", HOOK_SPEC, Rule.State.TEST);

        Run run = run();

        assertTrue(run.test());
        assertEquals(Run.Status.DONE, run.status());
        assertNull(run.lastError());
        assertTrue(f.integrations.calls.isEmpty());
    }

    @Test
    void theSimulationShowsOneMessageToTheConnection() {
        Rule rule = f.rule("hook", HOOK_SPEC, Rule.State.OFF);

        RuleSimulator.Simulation sim = f.simulator.simulate(TENANT, rule.id(),
                new RuleSimulator.SampleEvent("symptom.case.opened", new RuleSimulator.SampleContext("symptom_case",
                        "-7"), Map.of("assetId", "ABCD12", "level", 4), false, T0));

        assertTrue(sim.matches());
        assertEquals(List.of(), sim.recipients());
        assertEquals(2, sim.messages().size());
        RuleSimulator.SimulatedMessage first = sim.messages().get(0);
        assertEquals(0, first.step());
        assertEquals("webhook", first.channel());
        assertEquals(new RuleSimulator.To("conn-9", "webhook", null), first.to());
        assertTrue(first.text().startsWith("El conductor no respondió."), first.text());
        assertNull(sim.messages().get(1).text());
        assertTrue(f.integrations.calls.isEmpty());
    }
}
