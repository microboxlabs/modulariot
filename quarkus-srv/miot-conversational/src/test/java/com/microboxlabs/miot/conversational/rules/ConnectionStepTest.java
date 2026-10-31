package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.RulesFixture.T0;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.TENANT;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.event;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.panic;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * A connection step (webhook, Slack, Teams) calls its connection once per run, with its channel's body, and the
 * call is stored as a message to the connection.
 */
class ConnectionStepTest {

    private static final String HOOK_SPEC = """
            {"trigger": {"event": "symptom.case.opened"},
             "audience": [{"role": "driver"}],
             "steps": [
               {"channel": "webhook", "connection": "conn-9", "template": "panic-tower"},
               {"channel": "webhook", "connection": "conn-9"}
             ]}
            """;
    private static final String CHAT_SPEC = """
            {"trigger": {"event": "symptom.case.opened"}, "audience": [],
             "steps": [{"channel": "slack", "connection": "SLACK", "template": "panic-tower"},
                       {"channel": "teams", "connection": "TEAMS"}]}
            """;
    private static final String TEXT = "El conductor no respondió. Ubicación: -33.45679, -70.64827.";
    private static final String TITLE = "Pánico en ABCD12 (Código negro)";

    private final RulesFixture f = new RulesFixture();

    /** conn-9, the organization's webhook connection without a name. */
    @BeforeEach
    void aWebhookConnection() {
        String template = f.integrations.channels.ensureTemplate(ConnectionChannel.WEBHOOK, TENANT).id();
        f.integrations.connections.add(new IntegrationConnection("conn-9", TENANT, null, ProviderType.CUSTOM_HTTP,
                URI.create("https://hooks.example.com/miot"), null, ConnectionStatus.ACTIVE, null, null, Map.of(),
                template));
    }

    private Run run() {
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));
        f.engine.runDue();
        assertEquals(1, f.store.runs.size());
        return f.store.runs.values().iterator().next();
    }

    /** The chat rule, with a Slack and a Teams connection of the organization. */
    private String[] chatRule(Rule.State state) {
        String slack = f.integrations.channels.create(ConnectionChannel.SLACK, TENANT, "Canal torre",
                "https://hooks.example.com/slack", null).id();
        String teams = f.integrations.channels.create(ConnectionChannel.TEAMS, TENANT, "Equipo torre",
                "https://hooks.example.com/teams", null).id();
        f.rule("chat", CHAT_SPEC.replace("\"SLACK\"", "\"" + slack + "\"").replace("\"TEAMS\"", "\"" + teams + "\""),
                state);
        return new String[] {slack, teams};
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
        assertEquals(TITLE, body.get("title"));
        assertEquals(TEXT, body.get("text"));
        assertEquals(4, ((Map<?, ?>) body.get("data")).get("level"));

        Map<String, Object> second = calls.get(1).body();
        assertEquals(1, ((Map<?, ?>) second.get("run")).get("step"));
        assertNull(second.get("title"));
        assertNull(second.get("text"));

        assertTrue(f.whatsappSent.isEmpty());
    }

    @Test
    void aConnectionThatIsNotActiveIsNotCalled() {
        f.integrations.createdStatus = ConnectionStatus.TEST_FAILED;
        chatRule(Rule.State.ACTIVE);

        Run run = run();

        assertTrue(f.integrations.calls.isEmpty());
        assertTrue(run.lastError().contains("TEST_FAILED"), run.lastError());
    }

    @Test
    void eachCallIsStoredAsAMessageToTheConnection() {
        String[] ids = chatRule(Rule.State.ACTIVE);

        Run run = run();

        assertEquals(Run.Status.DONE, run.status());
        assertNull(run.lastError());
        List<Message> messages = f.store.conversations.messages;
        assertEquals(2, messages.size());
        Message slack = messages.get(0);
        assertEquals(Channel.SLACK, slack.channel());
        assertEquals(ids[0], slack.address());
        assertEquals(MessageDirection.OUTBOUND, slack.direction());
        assertEquals(MessageStatus.SENT, slack.status());
        assertNotNull(slack.sentAt());
        assertEquals(TEXT, slack.body());
        assertEquals("panic-tower", slack.templateName());
        assertEquals(Map.of("subject", TITLE, "httpStatus", 204), slack.metadata());
        assertEquals(run.id(), slack.runId());
        assertEquals(0, slack.step());
        assertNull(slack.providerMessageId());
        Conversation conversation = f.store.conversations.conversations.get(slack.conversationId());
        assertEquals(ContextKind.SYMPTOM_CASE, conversation.contextKind());
        assertEquals("-7", conversation.contextKey());
        assertEquals(ids[0], conversation.participantAddress());
        assertEquals("Canal torre", conversation.displayName());
        assertNull(conversation.phoneE164());
    }

    @Test
    void theTeamsStepWithoutATemplateSendsTheEventsLineAndTheActivityNamesEachConnection() {
        String[] ids = chatRule(Rule.State.ACTIVE);
        run();

        Message teams = f.store.conversations.messages.get(1);
        assertEquals(Channel.TEAMS, teams.channel());
        assertEquals(ids[1], teams.address());
        assertEquals("symptom.case.opened · symptom_case -7", teams.body(), "no template: the event's line");
        assertEquals(1, teams.step());
        assertTrue(f.integrations.calls.get(1).body().containsKey("attachments"));

        List<RunsService.RunMessageView> activity = f.runs.list(TENANT, null, null, null).get(0).messages();
        assertEquals(List.of("slack", "teams"), activity.stream().map(RunsService.RunMessageView::channel).toList());
        RunsService.RunMessageView first = activity.get(0);
        assertEquals(ids[0], first.to());
        assertEquals("Canal torre", first.toName());
        assertEquals("SENT", first.status());
        assertEquals(TEXT, first.text());
        assertEquals("Equipo torre", activity.get(1).toName());
    }

    @Test
    void aStepOnAnotherChannelsConnectionIsRefusedWithoutACall() {
        String slack = f.integrations.channels.create(ConnectionChannel.SLACK, TENANT, "Canal torre",
                "https://hooks.example.com/slack", null).id();
        f.rule("chat", """
                {"trigger": {"event": "symptom.case.opened"}, "audience": [],
                 "steps": [{"channel": "teams", "connection": "SLACK"}]}
                """.replace("SLACK", slack), Rule.State.ACTIVE);

        Run run = run();

        assertEquals("teams " + slack + ": The connection is not one of the organization's teams connections",
                run.lastError());
        assertTrue(f.integrations.calls.isEmpty());
        assertEquals(MessageStatus.FAILED, f.store.conversations.messages.get(0).status());
    }

    @Test
    void aSecondRunAboutTheSameCaseUsesTheSameConversation() {
        chatRule(Rule.State.ACTIVE);
        run();
        f.store.runs.clear();
        run();

        List<Message> messages = f.store.conversations.messages;
        assertEquals(4, messages.size());
        assertEquals(messages.get(0).conversationId(), messages.get(2).conversationId());
        assertEquals(2, f.store.conversations.conversations.size());
    }

    @Test
    void aRefusedOrFailedCallIsStoredFailedAndIsAProblemOnTheRun() {
        f.rule("hook", HOOK_SPEC, Rule.State.ACTIVE);
        f.integrations.answer = new OperationInvocationResult(500, "boom");

        Run refused = run();

        assertEquals(Run.Status.DONE, refused.status());
        assertEquals("webhook conn-9: HTTP 500: boom", refused.lastError());
        assertEquals(2, f.integrations.calls.size());
        Message failed = f.store.conversations.messages.get(0);
        assertEquals(Channel.WEBHOOK, failed.channel());
        assertEquals(MessageStatus.FAILED, failed.status());
        assertEquals("HTTP 500: boom", failed.errorMessage());
        assertNull(failed.sentAt());
        assertNull(f.store.conversations.conversations.get(failed.conversationId()).displayName(),
                "a connection without a name");

        f.store.runs.clear();
        f.store.conversations.messages.clear();
        f.integrations.answer = null;
        assertEquals("webhook conn-9: connection refused", run().lastError());
        Message thrown = f.store.conversations.messages.get(0);
        assertEquals(MessageStatus.FAILED, thrown.status());
        assertEquals("connection refused", thrown.errorMessage());
        assertEquals("FAILED", f.runs.list(TENANT, null, null, null).get(0).messages().get(0).status());

        f.store.runs.clear();
        f.store.conversations.messages.clear();
        f.integrations.thrown = new IllegalArgumentException("connection base URL points to an internal address");
        assertEquals(Run.Status.DONE, run().status());
        Message guarded = f.store.conversations.messages.get(0);
        assertEquals(MessageStatus.FAILED, guarded.status());
        assertEquals("connection base URL points to an internal address", guarded.errorMessage());
    }

    @Test
    void slackAndTeamsStepsSendTheirOwnBodies() {
        String[] ids = chatRule(Rule.State.ACTIVE);

        Run run = run();

        assertEquals(Run.Status.DONE, run.status());
        List<InMemoryIntegrations.Call> calls = f.integrations.calls;
        assertEquals(List.of(ids[0], ids[1]), calls.stream().map(InMemoryIntegrations.Call::connectionId).toList());
        assertEquals(Map.of("text", "*" + TITLE + "*\n" + TEXT), calls.get(0).body());
        assertEquals("message", calls.get(1).body().get("type"));

        f.store.runs.clear();
        f.integrations.calls.clear();
        f.integrations.answer = new OperationInvocationResult(400, "invalid_payload");
        assertEquals("teams " + ids[1] + ": HTTP 400: invalid_payload", run().lastError());
    }

    @Test
    void aTestRunCallsNothingAndStoresSimulatedMessages() {
        String[] ids = chatRule(Rule.State.TEST);

        Run run = run();

        assertTrue(run.test());
        assertEquals(Run.Status.DONE, run.status());
        assertNull(run.lastError());
        assertTrue(f.integrations.calls.isEmpty());
        List<Message> messages = f.store.conversations.messages;
        assertEquals(List.of(MessageStatus.SIMULATED, MessageStatus.SIMULATED),
                messages.stream().map(Message::status).toList());
        assertEquals(ids[0], messages.get(0).address());
        assertEquals(Map.of("subject", TITLE), messages.get(0).metadata());
        assertEquals(List.of("SIMULATED", "SIMULATED"), f.runs.list(TENANT, null, null, null).get(0).messages()
                .stream().map(RunsService.RunMessageView::status).toList());
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
        assertTrue(f.store.conversations.messages.isEmpty());
    }
}
