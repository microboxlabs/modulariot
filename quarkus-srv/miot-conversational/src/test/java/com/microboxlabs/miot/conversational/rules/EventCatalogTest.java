package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The event catalog's JSON, as the rule editor reads it. */
class EventCatalogTest {

    private final RulesFixture f = new RulesFixture();

    @Test
    void typesWithTheirFieldsAndVariables() throws Exception {
        JsonNode catalog = RulesFixture.JSON.readTree(RulesFixture.JSON.writeValueAsString(f.service.events()));

        assertEquals(2, catalog.size());
        JsonNode opened = catalog.get(0);
        assertEquals("symptom.case.opened", opened.path("type").asText());
        assertEquals("miot-symptoms", opened.path("source").asText());
        assertEquals("A symptom case opened", opened.path("description").asText());
        assertEquals("symptom_case", opened.path("contextKind").asText());

        JsonNode key = opened.path("fields").get(0);
        assertEquals("symptomKey", key.path("name").asText());
        assertEquals("Clave del síntoma", key.path("label").asText());
        assertEquals("The symptom's key", key.path("description").asText());
        assertEquals("string", key.path("type").asText());
        assertEquals(List.of("symptomKey:string", "symptomName:string", "level:number", "assetId:string",
                "latitude:number", "longitude:number", "levelSince:datetime", "urgent:boolean"), fields(opened));
        assertEquals("latitude", opened.path("fields").get(4).path("label").asText(), "no @Schema: the name");
        assertEquals(true, opened.path("fields").get(4).path("description").isNull());

        List<String> variables = new ArrayList<>();
        opened.path("variables").forEach(v -> variables.add(v.path("name").asText()));
        assertEquals(List.of("hora", "fecha", "nombre", "patente", "sintoma", "nivel", "ubicacion"), variables);
        assertEquals("Hora", opened.path("variables").get(0).path("label").asText());
    }

    @Test
    void variablesFollowThePayload() {
        record Plain(String code) {
        }
        assertEquals(List.of("hora", "fecha", "nombre"),
                EventCatalog.variables(EventCatalog.fields(Plain.class)).stream().map(EventCatalog.Field::name)
                        .toList());
        assertEquals(List.of(), EventCatalog.fields(String.class));
    }

    @Test
    void collectionAndMapFieldsAreNotReportedAsScalarStrings() {
        record Payload(List<String> changedFields, Map<String, Object> eventData, String label) {
        }
        assertEquals(List.of("changedFields:array", "eventData:object", "label:string"),
                EventCatalog.fields(Payload.class).stream().map(f -> f.name() + ":" + f.type()).toList());
    }

    private static List<String> fields(JsonNode type) {
        List<String> out = new ArrayList<>();
        type.path("fields").forEach(x -> out.add(x.path("name").asText() + ":" + x.path("type").asText()));
        return out;
    }
}
