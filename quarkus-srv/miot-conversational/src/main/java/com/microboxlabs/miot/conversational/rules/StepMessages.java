package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.RuleSpec.Step;
import com.microboxlabs.miot.core.event.Participant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The messages one step sends: one per recipient, rendered with the event's variables. Used by the engine to
 * send and by the simulation to show what would be sent.
 */
public final class StepMessages {

    /** A blank NAMED parameter is refused by Meta, so a variable without a value is sent as this. */
    static final String EMPTY_PARAM = "-";
    private static final String TEMPLATE = "La plantilla ";

    /**
     * One message.
     *
     * @param params WhatsApp: the Meta template's NAMED parameters
     * @param text   WhatsApp: the base text, rendered; email: the body, rendered; a connection channel: the email
     *               body, else the base text
     */
    public record Planned(String channel, Participant to, ConvTemplate template, Map<String, String> params,
            String subject, String text) {
    }

    public record Plan(List<Participant> recipients, List<Planned> messages, List<String> warnings) {
    }

    private StepMessages() {
    }

    public static Plan plan(Step step, RuleSpec spec, StoredEvent event, Optional<ConvTemplate> template,
            Audiences audiences) {
        Optional<ConnectionChannel> kind = step.connectionChannel();
        if (kind.isPresent()) {
            return viaConnection(kind.get(), step, event, template);
        }
        Audiences.Resolved resolved = audiences.resolve(event.tenantCode(), event.contextKind(), event.contextKey(),
                step.to() != null ? step.to() : spec.audience(), event.data(), step.channel(), event.asCelEvent());
        List<String> warnings = new ArrayList<>(resolved.warnings());
        List<Planned> out = new ArrayList<>();
        if (template.isEmpty()) {
            warnings.add(TEMPLATE + step.template() + " no existe");
            return new Plan(resolved.participants(), out, warnings);
        }
        if (resolved.participants().isEmpty()) {
            warnings.add("El paso no tiene destinatarios");
        }
        for (Participant p : resolved.participants()) {
            String channel = RuleSpec.PREFERRED.equals(step.channel()) ? p.channel() : step.channel();
            if (channel == null || !channel.equals(p.channel())) {
                warnings.add(p.address() + " no tiene dirección de " + channel);
            } else {
                message(channel, p, template.get(), TemplateVariables.of(event.data(), event.at(), p.name()))
                        .ifPresentOrElse(out::add, () -> warnings.add(
                                TEMPLATE + template.get().key() + " no tiene versión de " + channel));
            }
        }
        return new Plan(resolved.participants(), out, warnings);
    }

    /**
     * A connection step: one message to its connection, whose address is the connection id. Its subject is the
     * template's email subject, else its name; its text the email body, else the base text. No template, neither.
     */
    private static Plan viaConnection(ConnectionChannel kind, Step step, StoredEvent event,
            Optional<ConvTemplate> template) {
        if (step.connection() == null) {
            return new Plan(List.of(), List.of(), List.of("El paso no tiene conexión"));
        }
        if (step.template() != null && template.isEmpty()) {
            return new Plan(List.of(), List.of(), List.of(TEMPLATE + step.template() + " no existe"));
        }
        String subject = null;
        String text = null;
        if (template.isPresent()) {
            ConvTemplate t = template.get();
            Map<String, String> vars = TemplateVariables.of(event.data(), event.at(), null);
            boolean email = t.email() != null;
            subject = email ? TemplateVariables.render(t.email().subject(), vars) : t.name();
            text = TemplateVariables.render(email ? t.email().body() : t.baseText(), vars);
        }
        Participant to = new Participant(step.connection(), kind.key(), null, null, null);
        return new Plan(List.of(), List.of(new Planned(kind.key(), to, template.orElse(null), Map.of(),
                subject, text)), List.of());
    }

    /** The message on this channel, or empty when the template has no variant for it. */
    private static Optional<Planned> message(String channel, Participant p, ConvTemplate t, Map<String, String> vars) {
        if (RuleSpec.WHATSAPP.equals(channel) && t.whatsapp() != null && t.whatsapp().metaName() != null) {
            String text = t.baseText() != null ? TemplateVariables.render(t.baseText(), vars) : t.whatsapp().metaName();
            return Optional.of(new Planned(channel, p, t, params(t.whatsapp(), vars), null, text));
        }
        if (RuleSpec.EMAIL.equals(channel) && t.email() != null) {
            return Optional.of(new Planned(channel, p, t, Map.of(), TemplateVariables.render(t.email().subject(), vars),
                    TemplateVariables.render(t.email().body(), vars)));
        }
        return Optional.empty();
    }

    private static Map<String, String> params(ConvTemplate.WhatsApp whatsapp, Map<String, String> vars) {
        Map<String, String> params = new LinkedHashMap<>();
        for (String name : whatsapp.params()) {
            String value = vars.get(name);
            params.put(name, value == null || value.isBlank() ? EMPTY_PARAM : value);
        }
        return params;
    }
}
