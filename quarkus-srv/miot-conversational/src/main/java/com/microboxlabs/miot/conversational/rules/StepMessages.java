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

    /**
     * One message.
     *
     * @param params WhatsApp: the Meta template's NAMED parameters
     * @param text   WhatsApp: the base text, rendered; email: the body, rendered
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
        Audiences.Resolved resolved = audiences.resolve(event.tenantCode(), event.contextKind(), event.contextKey(),
                step.to() != null ? step.to() : spec.audience(), event.data());
        List<String> warnings = new ArrayList<>(resolved.warnings());
        List<Planned> out = new ArrayList<>();
        if (template.isEmpty()) {
            warnings.add("La plantilla " + step.template() + " no existe");
            return new Plan(resolved.participants(), out, warnings);
        }
        if (resolved.participants().isEmpty()) {
            warnings.add("El paso no tiene destinatarios");
        }
        ConvTemplate t = template.get();
        for (Participant p : resolved.participants()) {
            String channel = RuleSpec.PREFERRED.equals(step.channel()) ? p.channel() : step.channel();
            if (channel == null || !channel.equals(p.channel())) {
                warnings.add(p.address() + " no tiene dirección de " + channel);
                continue;
            }
            Map<String, String> vars = TemplateVariables.of(event.data(), event.at(), p.name());
            if (RuleSpec.WHATSAPP.equals(channel) && t.whatsapp() != null && t.whatsapp().metaName() != null) {
                Map<String, String> params = new LinkedHashMap<>();
                for (String name : t.whatsapp().params()) {
                    String value = vars.get(name);
                    params.put(name, value == null || value.isBlank() ? EMPTY_PARAM : value);
                }
                String text = t.baseText() != null ? TemplateVariables.render(t.baseText(), vars)
                        : t.whatsapp().metaName();
                out.add(new Planned(channel, p, t, params, null, text));
            } else if (RuleSpec.EMAIL.equals(channel) && t.email() != null) {
                out.add(new Planned(channel, p, t, Map.of(), TemplateVariables.render(t.email().subject(), vars),
                        TemplateVariables.render(t.email().body(), vars)));
            } else {
                warnings.add("La plantilla " + t.key() + " no tiene versión de " + channel);
            }
        }
        return new Plan(resolved.participants(), out, warnings);
    }
}
