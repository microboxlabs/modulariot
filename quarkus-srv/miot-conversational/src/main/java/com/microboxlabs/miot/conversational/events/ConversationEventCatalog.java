package com.microboxlabs.miot.conversational.events;

import com.microboxlabs.miot.core.event.EventTypeCatalog;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/** The conversation events other modules and rules can react to. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ConversationEventCatalog implements EventTypeCatalog {

    public static final String EVENT_SOURCE = "miot-conversational";
    public static final String REPLY_RECEIVED = "conversation.reply_received";

    private static final List<EventType> TYPES = List.of(
            new EventType(REPLY_RECEIVED,
                    "Someone replied to a message a rule sent; the context is the one of the event that started it",
                    ConversationReplyData.class));

    @Override
    public String source() {
        return EVENT_SOURCE;
    }

    @Override
    public List<EventType> types() {
        return TYPES;
    }
}
