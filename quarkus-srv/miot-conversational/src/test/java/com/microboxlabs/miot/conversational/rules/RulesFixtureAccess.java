package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** {@link RulesFixture} for tests outside this package. */
public final class RulesFixtureAccess {

    public static final String TENANT = RulesFixture.TENANT;
    public static final String DRIVER = RulesFixture.DRIVER;
    public static final String PANIC = RulesFixture.PANIC_SPEC;
    public static final ObjectMapper JSON = RulesFixture.JSON;

    private final RulesFixture fixture = new RulesFixture();

    public RulesService service() {
        return fixture.service;
    }

    public RuleSimulator simulator() {
        return fixture.simulator;
    }

    public RuleTestSends testSends() {
        return fixture.testSends;
    }

    public TemplatesService templates() {
        return fixture.templates;
    }

    public RunsService runs() {
        return fixture.runs;
    }

    public ConnectionChannels channels() {
        return fixture.integrations.channels;
    }

    public static JsonNode json(String text) {
        return RulesFixture.json(text);
    }

    /** A panic case at level 4 opens and the due runs are scanned. */
    public void openPanicCaseAndRun() {
        fixture.engine.accept(RulesFixture.event("symptom.case.opened", "-7", RulesFixture.panic(4), false));
        fixture.engine.runDue();
    }

    public boolean sentNothing() {
        return fixture.whatsappSent.isEmpty() && fixture.emailsSent.isEmpty()
                && fixture.store.conversations.messages.isEmpty() && fixture.store.runs.isEmpty()
                && fixture.store.events.isEmpty();
    }
}
