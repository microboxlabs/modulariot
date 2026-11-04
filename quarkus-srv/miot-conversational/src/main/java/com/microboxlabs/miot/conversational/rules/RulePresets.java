package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.conversational.calling.CallPermissionService;
import java.util.List;
import java.util.Optional;

/**
 * Ready-made rules an organization can add to Comunicaciones. Adding one creates an ordinary rule, OFF, with the
 * preset's spec as its draft (see {@link RulesService#create}); nothing runs until someone publishes and turns it
 * on.
 */
public final class RulePresets {

    public record Preset(String key, String name, String description, JsonNode spec) {
    }

    /** Trip departure: ask the trip's driver for permission to call them over WhatsApp. */
    public static final String TRIP_DEPARTURE_CALL_PERMISSION = "trip-departure-call-permission";
    static final String DRIVER_GROUP = "driver";
    private static final ObjectMapper JSON = new ObjectMapper();

    private static final List<Preset> PRESETS = List.of(new Preset(
            TRIP_DEPARTURE_CALL_PERMISSION,
            "Salida del viaje → solicitar permiso de llamada al conductor",
            "Cuando se confirma la salida del viaje, pide al conductor permiso para llamarlo por WhatsApp. Meta"
                    + " permite 1 solicitud por día y 2 por semana a cada conductor; las demás no se envían.",
            spec("""
                    {
                      "family": "trips",
                      "trigger": {
                        "event": "trip.milestone.confirmed",
                        "when": "event.data.milestone == 'departure'"
                      },
                      "groups": [
                        {
                          "id": "%s",
                          "name": "Conductor del viaje",
                          "entries": [{"contacts": "contact.nationalId == nationalId(event.data.driver)"}]
                        }
                      ],
                      "steps": [
                        {"after": 0, "channel": "whatsapp", "template": "%s", "to": ["%s"], "waitForReply": 0}
                      ]
                    }""".formatted(DRIVER_GROUP, CallPermissionService.TEMPLATE_KEY, DRIVER_GROUP))));

    private RulePresets() {
    }

    public static List<Preset> all() {
        return PRESETS;
    }

    public static Optional<Preset> find(String key) {
        return PRESETS.stream().filter(p -> p.key().equals(key)).findFirst();
    }

    private static JsonNode spec(String json) {
        try {
            return JSON.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Preset spec is not JSON", e);
        }
    }
}
