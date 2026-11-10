package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.conversational.rules.ConvTemplate.Teams;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** A template's Teams card drawn as the Adaptive Card a Workflows webhook takes. */
class TeamsCardTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** A card with every part, like an order notice. */
    static final Teams CARD = new Teams("Order {{order}} shipped", "{{author}} &lt;{{authorEmail}}&gt;",
            "Created {{created}}", "Order {{order}} left the warehouse.\n{{comment}}",
            new Teams.Images("photos", "Photo {{n}}: {{name}}"),
            List.of(new Teams.Fact("Reason", "{{reason}}", true), new Teams.Fact("Order", "{{order}}"),
                    new Teams.Fact("Route", "{{from}} - {{to}}")),
            List.of("{{departure}}", "{{arrival}}"),
            List.of(new Teams.Action("Open", "{{link}}")));

    private static Map<String, Object> data() {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("order", "4521");
        d.put("author", "Ana");
        d.put("authorEmail", "ana@example.com");
        d.put("created", "2026-11-10");
        d.put("comment", "");
        d.put("reason", "-");
        d.put("from", "A");
        d.put("to", "B");
        d.put("departure", "Departure: 10-11-2026 08:00");
        d.put("arrival", "-");
        d.put("link", "https://app.example.com/orders/4521");
        d.put("photos", List.of(Map.of("name", "front.jpg", "url", "https://files.example.com/1"),
                Map.of("name", "back.jpg", "url", "https://files.example.com/2")));
        return d;
    }

    private static JsonNode draw(Teams card, Map<String, Object> data) {
        return JSON.valueToTree(TeamsCard.body(card, TemplateVariables.of(data, null, null), data));
    }

    @Test
    void drawsEveryPartInTheCardsOrder() throws Exception {
        JsonNode expected = JSON.readTree("""
                {"type": "message", "attachments": [{
                  "contentType": "application/vnd.microsoft.card.adaptive",
                  "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard", "version": "1.4",
                    "body": [
                      {"type": "TextBlock", "size": "Medium", "weight": "Bolder", "text": "Order 4521 shipped",
                       "style": "heading", "wrap": true},
                      {"type": "ColumnSet", "columns": [{"type": "Column", "items": [
                        {"type": "TextBlock", "weight": "Bolder", "text": "Ana &lt;ana@example.com&gt;", "wrap": true},
                        {"type": "TextBlock", "spacing": "None", "text": "Created 2026-11-10", "isSubtle": true,
                         "wrap": true}], "width": "stretch"}]},
                      {"type": "TextBlock", "text": "Order 4521 left the warehouse.", "wrap": true},
                      {"type": "ColumnSet", "columns": [{"type": "Column", "items": [
                        {"type": "TextBlock", "text": "Photo 1: front.jpg", "wrap": true},
                        {"type": "Image", "style": "Default", "url": "https://files.example.com/1",
                         "altText": "front.jpg", "size": "Auto"},
                        {"type": "TextBlock", "text": "Photo 2: back.jpg", "wrap": true},
                        {"type": "Image", "style": "Default", "url": "https://files.example.com/2",
                         "altText": "back.jpg", "size": "Auto"}], "width": "stretch"}]},
                      {"type": "FactSet", "facts": [{"title": "Order", "value": "4521"},
                                                    {"title": "Route", "value": "A - B"}]},
                      {"type": "TextBlock", "text": " "},
                      {"type": "TextBlock", "spacing": "None", "text": "Departure: 10-11-2026 08:00",
                       "isSubtle": true, "wrap": true},
                      {"type": "TextBlock", "spacing": "None", "text": "-", "isSubtle": true, "wrap": true}
                    ],
                    "actions": [{"type": "Action.OpenUrl", "title": "Open",
                                 "url": "https://app.example.com/orders/4521"}]
                  }}]}
                """);
        assertEquals(expected, draw(CARD, data()));
    }

    @Test
    void anOptionalFactWithAValueIsKept() {
        Map<String, Object> d = data();
        d.put("reason", "Damaged seal");
        JsonNode facts = draw(CARD, d).at("/attachments/0/content/body/4/facts");
        assertEquals("Reason", facts.get(0).get("title").asText());
        assertEquals("Damaged seal", facts.get(0).get("value").asText());
    }

    @Test
    void aTextWithQuotesAndLineBreaksIsStillJson() throws Exception {
        Map<String, Object> d = data();
        d.put("comment", "He said \"wait\"\nthen left");
        String body = JSON.writeValueAsString(TeamsCard.body(CARD, TemplateVariables.of(d, null, null), d));
        JsonNode text = JSON.readTree(body).at("/attachments/0/content/body/2/text");
        assertEquals("Order 4521 left the warehouse.\nHe said \"wait\"\nthen left", text.asText());
    }

    @Test
    void partsWithoutValuesAreLeftOut() {
        Teams bare = new Teams("Hello {{who}}", null, null, null, new Teams.Images("photos", null), List.of(),
                List.of("{{none}}"), List.of(new Teams.Action("Open", "{{none}}")));
        JsonNode content = draw(bare, Map.of("who", "Ana")).at("/attachments/0/content");
        assertEquals(1, content.get("body").size());
        assertEquals("Hello Ana", content.at("/body/0/text").asText());
        assertFalse(content.has("actions"));
    }

    @Test
    void theInboxKeepsTheCardsTitleAndText() {
        Map<String, String> vars = TemplateVariables.of(data(), null, null);
        assertEquals("Order 4521 shipped", TeamsCard.subject(CARD, vars));
        assertEquals("Order 4521 left the warehouse.", TeamsCard.text(CARD, vars));
        assertNull(TeamsCard.text(new Teams("T", null, null, null, null, null, null, null), vars));
    }

    @Test
    void aCardNeedsATitleOrTextAndCompleteFactsAndActions() {
        assertTrue(TeamsCard.problems(CARD).isEmpty());
        assertEquals(List.of("teams needs a title or a text", "teams.images.field is required",
                "each teams fact needs a title", "each teams action needs a title and a url"),
                TeamsCard.problems(new Teams(" ", null, null, null, new Teams.Images(null, null),
                        List.of(new Teams.Fact(null, "x")), null, List.of(new Teams.Action("Open", null)))));
    }

    @Test
    void nullEntriesAreDropped() throws Exception {
        Teams read = JSON.readValue("{\"title\": \"T\", \"facts\": [null], \"notes\": [null, \"n\"]}",
                Teams.class);
        assertTrue(read.facts().isEmpty());
        assertEquals(List.of("n"), read.notes());
    }

    @Test
    void theCardReadsBackFromItsJson() throws Exception {
        Teams read = JSON.readValue(JSON.writeValueAsString(CARD), Teams.class);
        assertEquals(CARD, read);
        Teams partial = JSON.readValue("{\"title\": \"T\", \"facts\": [{\"title\": \"A\", \"value\": \"b\"}]}",
                Teams.class);
        assertFalse(partial.facts().get(0).optional());
        assertTrue(partial.actions().isEmpty());
    }
}
