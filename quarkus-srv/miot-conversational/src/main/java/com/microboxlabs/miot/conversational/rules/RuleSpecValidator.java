package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.RuleSpec.Audience;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Step;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.BiPredicate;
import java.util.function.Function;

/**
 * Checks a rule spec. Errors block publishing; warnings do not. Each finding has a code the editor translates,
 * its params, and a Spanish message for codes it does not know.
 */
public final class RuleSpecValidator {

    public enum Severity {
        ERROR,
        WARNING
    }

    /**
     * One finding.
     *
     * @param section  {@code trigger}, {@code audience.N} or {@code steps.N}, zero-based
     * @param position character offset in {@code trigger.when}, or -1
     */
    public record Finding(String section, Severity severity, String code, Map<String, Object> params,
            String message, int position) {
    }

    /**
     * What the spec is checked against.
     *
     * @param eventTypes the event types the catalog knows, with their context kind (null when none)
     * @param templates  the tenant's templates by key
     * @param roles      the roles known for a context kind; empty when nobody resolves roles for it
     */
    public record Context(Map<String, String> eventTypes, Map<String, ConvTemplate> templates,
            Function<String, Optional<List<String>>> roles, BiPredicate<String, String> connections) {

        /** Every connection id counts as one of the organization's. */
        public Context(Map<String, String> eventTypes, Map<String, ConvTemplate> templates,
                Function<String, Optional<List<String>>> roles) {
            this(eventTypes, templates, roles, (channel, id) -> true);
        }
    }

    public static final String TRIGGER = "trigger";
    /** The 1-based number of the step or audience entry a finding is about, in its params. */
    public static final String STEP = "step";
    public static final String ENTRY = "entry";
    private static final String CHANNEL = "channel";
    private static final String TEMPLATE = "template";
    private static final Set<String> CHANNELS = Set.of(RuleSpec.WHATSAPP, RuleSpec.EMAIL, RuleSpec.PREFERRED,
            RuleSpec.WEBHOOK, RuleSpec.SLACK, RuleSpec.TEAMS);
    private static final Set<String> CHANNELS_WITH_REPLIES = Set.of(RuleSpec.WHATSAPP, RuleSpec.EMAIL,
            RuleSpec.PREFERRED);
    private static final Set<String> ADDRESS_CHANNELS = Set.of(RuleSpec.WHATSAPP, RuleSpec.EMAIL);

    private RuleSpecValidator() {
    }

    static final int MAX_FAMILY = 96;

    public static boolean publishable(List<Finding> findings) {
        return findings.stream().noneMatch(f -> f.severity() == Severity.ERROR);
    }

    public static List<Finding> validate(RuleSpec spec, Context context) {
        List<Finding> out = new ArrayList<>();
        String contextKind = trigger(out, spec, context);
        Optional<List<String>> roles = contextKind == null ? Optional.empty() : context.roles().apply(contextKind);
        boolean usesAudience = spec.steps().stream().anyMatch(s -> !s.viaConnection() && s.to() == null && !s.toInvalid());
        if (spec.audience().isEmpty() && usesAudience) {
            out.add(error("audience.0", "noAudience", Map.of(), "Falta decir a quién se escribe."));
        }
        for (int i = 0; i < spec.audience().size(); i++) {
            List<Finding> entry = new ArrayList<>();
            audience(entry, "audience." + i, spec.audience().get(i), roles, contextKind);
            numbered(out, entry, ENTRY, i + 1);
        }
        if (spec.family() != null && spec.family().codePointCount(0, spec.family().length()) > MAX_FAMILY) {
            out.add(error("family", "familyTooLong", Map.of("max", MAX_FAMILY),
                    "La familia no puede tener más de " + MAX_FAMILY + " caracteres."));
        }
        if (spec.steps().isEmpty()) {
            out.add(error("steps.0", "noSteps", Map.of(), "La regla no tiene pasos."));
        }
        for (int i = 0; i < spec.steps().size(); i++) {
            List<Finding> step = new ArrayList<>();
            step(step, "steps." + i, spec.steps().get(i), context, roles, contextKind);
            numbered(out, step, STEP, i + 1);
        }
        return out;
    }

    /** Checks the trigger; returns the event's context kind when the event type is known. */
    private static String trigger(List<Finding> out, RuleSpec spec, Context context) {
        String event = spec.trigger() == null ? null : spec.trigger().event();
        String kind = null;
        if (event == null) {
            out.add(error(TRIGGER, "noEvent", Map.of(), "Falta elegir el evento que inicia la regla."));
        } else if (!context.eventTypes().containsKey(event)) {
            out.add(error(TRIGGER, "noEvent", Map.of("event", event), "El evento " + event + " no existe."));
        } else {
            kind = context.eventTypes().get(event);
        }
        String when = spec.trigger() == null ? null : spec.trigger().when();
        EventCondition.check(when).ifPresent(issue -> out.add(new Finding(TRIGGER, Severity.ERROR, "whenInvalid",
                Map.of("detail", issue.detail()), issue.message(), issue.position())));
        return kind;
    }

    private static void audience(List<Finding> out, String section, Audience a, Optional<List<String>> roles,
            String contextKind) {
        if (a.role() != null) {
            if (roles.isEmpty()) {
                if (contextKind != null) {
                    out.add(warning(section, "unknownRole", Map.of("role", a.role()),
                            "Nadie resuelve roles para este evento: el rol " + a.role() + " no tendrá destinatarios."));
                }
            } else if (roles.get().stream().noneMatch(r -> r.equalsIgnoreCase(a.role()))) {
                out.add(warning(section, "unknownRole", Map.of("role", a.role()),
                        "Ningún contacto tiene el rol " + a.role() + "."));
            }
        } else if (a.address() != null) {
            if (a.channel() == null || !ADDRESS_CHANNELS.contains(a.channel())) {
                out.add(error(section, "audienceBadChannel", Map.of("address", a.address()),
                        "Di si la dirección " + a.address() + " es de WhatsApp o de correo."));
            }
        } else if (a.path() == null) {
            out.add(error(section, "audienceEmptyEntry", Map.of(),
                    "Elige un rol, una dirección o un campo del evento."));
        }
    }

    private static void step(List<Finding> out, String section, Step s, Context context,
            Optional<List<String>> roles, String contextKind) {
        String channel = s.channel() == null ? null : s.channel().toLowerCase(Locale.ROOT);
        if (channel == null || !CHANNELS.contains(channel)) {
            out.add(error(section, "stepBadChannel", params(CHANNEL, s.channel()),
                    "Elige el canal del paso: WhatsApp, correo, el preferido, un webhook, Slack o Teams."));
        }
        template(out, section, s, context, channel);
        timing(out, section, s, channel);
        if (s.viaConnection()) {
            if (s.connection() == null) {
                out.add(error(section, "stepNoConnection", params(CHANNEL, channel),
                        "Elige la conexión que llama el paso."));
            } else if (!context.connections().test(channel, s.connection())) {
                out.add(error(section, "stepUnknownConnection", params(CHANNEL, channel),
                        "La conexión del paso ya no existe o no es de este canal."));
            }
        } else {
            recipients(out, section, s, roles, contextKind);
        }
    }

    /** A connection step may go without a template: it sends the event alone. */
    private static void template(List<Finding> out, String section, Step s, Context context, String channel) {
        if (s.template() == null && s.viaConnection()) {
            return;
        }
        if (s.template() == null) {
            out.add(error(section, "stepNoTemplate", Map.of(), "Falta elegir la plantilla del paso."));
            return;
        }
        ConvTemplate t = context.templates().get(s.template());
        if (t == null) {
            out.add(error(section, "stepUnknownTemplate", Map.of(TEMPLATE, s.template()),
                    "La plantilla " + s.template() + " no existe."));
        } else {
            variant(out, section, s, t, channel);
        }
    }

    private static void timing(List<Finding> out, String section, Step s, String channel) {
        if (s.waitMinutes() > 0 && (channel == null || !CHANNELS_WITH_REPLIES.contains(channel))) {
            out.add(error(section, "stepWaitNeedsReplies", params(CHANNEL, s.channel()),
                    "Solo se puede esperar respuesta en un canal que recibe respuestas."));
        }
        if (negative(s.after()) || negative(s.waitForReply())) {
            out.add(error(section, "stepNegativeMinutes", Map.of(), "Los minutos no pueden ser negativos."));
        }
        if (s.onReply() != null && !RuleSpec.STOP.equals(s.onReply()) && !RuleSpec.CONTINUE.equals(s.onReply())) {
            out.add(error(section, "stepBadOnReply", Map.of("onReply", s.onReply()),
                    "Al recibir respuesta la regla se detiene o continúa."));
        }
    }

    private static void recipients(List<Finding> out, String section, Step s, Optional<List<String>> roles,
            String contextKind) {
        if (s.toInvalid()) {
            out.add(error(section, "stepBadRecipients", Map.of(),
                    "Los destinatarios del paso son la audiencia o una lista."));
            return;
        }
        if (s.to() == null) {
            return;
        }
        if (s.to().isEmpty()) {
            out.add(error(section, "stepNoRecipients", Map.of(), "El paso no tiene destinatarios."));
        }
        s.to().forEach(a -> audience(out, section, a, roles, contextKind));
    }

    private static boolean negative(Integer minutes) {
        return minutes != null && minutes < 0;
    }

    private static void variant(List<Finding> out, String section, Step s, ConvTemplate t, String channel) {
        boolean missing = switch (channel == null ? "" : channel) {
            case RuleSpec.WHATSAPP -> t.whatsapp() == null || t.whatsapp().metaName() == null;
            case RuleSpec.EMAIL -> t.email() == null || t.email().subject() == null || t.email().body() == null;
            case RuleSpec.PREFERRED -> t.whatsapp() == null && t.email() == null;
            default -> false;
        };
        if (missing) {
            out.add(error(section, "stepTemplateNoChannel", Map.of(TEMPLATE, s.template(), CHANNEL, channel),
                    "La plantilla " + s.template() + " no tiene versión para este canal."));
        }
    }

    /** Adds the findings with the step or entry number in their params. */
    private static void numbered(List<Finding> out, List<Finding> findings, String key, int number) {
        for (Finding f : findings) {
            Map<String, Object> p = new LinkedHashMap<>(f.params());
            p.put(key, number);
            out.add(new Finding(f.section(), f.severity(), f.code(), p, f.message(), f.position()));
        }
    }

    private static Map<String, Object> params(String key, Object value) {
        Map<String, Object> p = new LinkedHashMap<>();
        if (value != null) {
            p.put(key, value);
        }
        return p;
    }

    private static Finding error(String section, String code, Map<String, Object> params, String message) {
        return new Finding(section, Severity.ERROR, code, params, message, -1);
    }

    private static Finding warning(String section, String code, Map<String, Object> params, String message) {
        return new Finding(section, Severity.WARNING, code, params, message, -1);
    }
}
