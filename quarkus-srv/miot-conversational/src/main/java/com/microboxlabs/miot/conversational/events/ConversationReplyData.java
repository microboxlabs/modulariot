package com.microboxlabs.miot.conversational.events;

import java.time.Instant;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** A reply to a message a rule sent, with the event that started the rule. */
@Schema(title = "Respuesta")
public record ConversationReplyData(
        @Schema(title = "Ejecución", description = "The rule run the replied message belongs to") String runId,
        @Schema(title = "Regla", description = "The rule of that run") String ruleId,
        @Schema(title = "Evento", description = "The type of the event that started the run") String eventType,
        @Schema(title = "Datos del evento", description = "The data of that event") Map<String, Object> eventData,
        @Schema(title = "Mensaje", description = "The reply's message id") String messageId,
        @Schema(title = "Responde a", description = "The message it answers, when the provider says so")
        String inReplyTo,
        @Schema(title = "Canal", description = "whatsapp, email, …") String channel,
        @Schema(title = "Dirección", description = "The phone or email that replied") String address,
        @Schema(title = "Texto", description = "The reply's text, or the button's text") String text,
        @Schema(title = "Botón", description = "The payload of the quick-reply button tapped, if any")
        String buttonPayload,
        @Schema(title = "Hora", description = "When the reply arrived") Instant at) {
}
