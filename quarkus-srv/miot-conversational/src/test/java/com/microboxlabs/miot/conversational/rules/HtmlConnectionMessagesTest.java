package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class HtmlConnectionMessagesTest {

    private static final Instant AT = Instant.parse("2026-10-01T12:00:00Z");
    private static final StoredEvent EVENT = new StoredEvent("event", "example-tenant", "geocoding.quota.threshold",
            "miot-integrations", "geocoding_quota", "example-org", Map.of("company", "Example", "used", 80),
            false, AT, AT);

    @ParameterizedTest
    @ValueSource(strings = {"webhook", "slack", "teams"})
    void htmlSubjectsAreRenderedWithOrWithoutShortText(String channel) {
        for (String shortText : List.of("", "Short {{used}}")) {
            StepMessages.Plan plan = plan(channel, shortText, "<p>{{used}}</p>");
            assertTrue(plan.warnings().isEmpty());
            assertEquals(1, plan.messages().size());
            assertEquals("Quota for Example", plan.messages().get(0).subject());
            assertEquals(shortText.isEmpty() ? "80" : "Short 80", plan.messages().get(0).text().strip());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"webhook", "slack", "teams"})
    void invalidHtmlIsReportedWithoutSendingAFallbackMessage(String channel) {
        StepMessages.Plan plan = plan(channel, "", "{{#if company}}unclosed");
        assertTrue(plan.messages().isEmpty());
        assertEquals(1, plan.warnings().size());
        assertTrue(plan.warnings().get(0).contains("quota"));
    }

    private static StepMessages.Plan plan(String channel, String shortText, String html) {
        RuleSpec.Step step = new RuleSpec.Step(null, channel, "quota", List.of(), false, null, null, "connection");
        ConvTemplate template = new ConvTemplate("template", ConvTemplate.PLATFORM_TENANT, "quota", "Quota",
                shortText, null, new ConvTemplate.Email("{{#if company}}Quota for {{company}}{{/if}}", null, html),
                AT, AT, "owner@example.com", "0.1.0");
        return StepMessages.plan(step, null, EVENT, Optional.of(template), null);
    }
}
