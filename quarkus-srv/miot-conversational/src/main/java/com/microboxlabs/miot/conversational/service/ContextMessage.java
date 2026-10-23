package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A message a rule's run sends about a context, stored on the conversation {@code (contextKind, contextKey, to)}.
 *
 * @param contextKind  null for a context kind the conversations do not know; the message then goes to the
 *                     participant's conversation without context
 * @param templateName WhatsApp: the Meta template; email: the template key, kept on the message
 * @param params       WhatsApp: the template's NAMED parameters
 * @param subject      email only
 * @param body         the text stored on the message (WhatsApp: the template's base text, rendered)
 */
public record ContextMessage(ContextKind contextKind, String contextKey, String to, String displayName,
        String role, String contactId, String templateName, String language, Map<String, String> params,
        String subject, String body, String runId, Integer step) {

    public ContextMessage {
        params = params == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(params));
    }

    /** The recipient as a conversation participant; {@code phoneE164} is null for email. */
    public ConversationRepository.ContextParticipant participant(String phoneE164) {
        return new ConversationRepository.ContextParticipant(contextKind, contextKey, to, phoneE164, displayName,
                role, contactId);
    }
}
