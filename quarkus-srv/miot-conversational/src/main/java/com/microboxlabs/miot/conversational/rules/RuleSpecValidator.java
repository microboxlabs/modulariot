package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.RuleSpec.Audience;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Group;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Step;
import java.util.ArrayList;
import java.util.HashSet;
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
     * @param section  {@code trigger}, {@code groups.N} or {@code steps.N}, zero-based
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
    /** The 1-based number of the step, group or group entry a finding is about, in its params. */
    public static final String STEP = "step";
    public static final String GROUP = "group";
    public static final String ENTRY = "entry";
    private static final String CHANNEL = "channel";
    private static final String TEMPLATE = "template";
    private static final String NOT_FOUND = " no existe.";
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
        groups(out, spec, roles, contextKind);
        if (spec.family() != null && spec.family().codePointCount(0, spec.family().length()) > MAX_FAMILY) {
            out.add(error("family", "familyTooLong", Map.of("max", MAX_FAMILY),
                    "La familia no puede tener más de " + MAX_FAMILY + " caracteres."));
        }
        if (spec.steps().isEmpty()) {
            out.add(error("steps.0", "noSteps", Map.of(), "La regla no tiene pasos."));
        }
        for (int i = 0; i < spec.steps().size(); i++) {
            List<Finding> step = new ArrayList<>();
            step(step, "steps." + i, spec.steps().get(i), spec, context);
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
            out.add(error(TRIGGER, "noEvent", Map.of("event", event), "El evento " + event + NOT_FOUND));
        } else {
            kind = context.eventTypes().get(event);
        }
        String when = spec.trigger() == null ? null : spec.trigger().when();
        EventCondition.check(when).ifPresent(issue -> out.add(new Finding(TRIGGER, Severity.ERROR, "whenInvalid",
                Map.of("detail", issue.detail()), issue.message(), issue.position())));
        return kind;
    }

    private static void groups(List<Finding> out, RuleSpec spec, Optional<List<String>> roles, String contextKind) {
        Set<String> ids = new HashSet<>();
        Set<String> used = new HashSet<>();
        spec.steps().stream().filter(st -> !st.viaConnection()).forEach(st -> used.addAll(st.to()));
        for (int i = 0; i < spec.groups().size(); i++) {
            Group g = spec.groups().get(i);
            String section = "groups." + i;
            List<Finding> group = new ArrayList<>();
            if (g.id() == null) {
                group.add(error(section, "groupNoId", Map.of(), "El grupo no tiene identificador."));
            } else if (!ids.add(g.id())) {
                group.add(error(section, "groupDuplicateId", Map.of("id", g.id()),
                        "Dos grupos tienen el identificador " + g.id() + "."));
            } else if (!used.contains(g.id())) {
                group.add(warning(section, "groupUnused", Map.of("id", g.id()), "Ningún paso escribe a este grupo."));
            }
            if (g.entries().isEmpty()) {
                group.add(error(section, "groupEmpty", Map.of(), "El grupo no tiene destinatarios."));
            }
            for (int j = 0; j < g.entries().size(); j++) {
                List<Finding> entry = new ArrayList<>();
                audience(entry, section, g.entries().get(j), roles, contextKind);
                numbered(group, entry, ENTRY, j + 1);
            }
            numbered(out, group, GROUP, i + 1);
        }
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
        } else if (a.contacts() != null) {
            EventCondition.checkContact(a.contacts()).ifPresent(issue -> out.add(new Finding(section, Severity.ERROR,
                    "contactsInvalid", Map.of("detail", issue.detail()), issue.message(), issue.position())));
        } else if (a.path() == null) {
            out.add(error(section, "audienceEmptyEntry", Map.of(),
                    "Elige un rol, una dirección, un campo del evento o una condición sobre la libreta."));
        }
    }

    private static void step(List<Finding> out, String section, Step s, RuleSpec spec, Context context) {
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
            recipients(out, section, s, spec);
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
                    "La plantilla " + s.template() + NOT_FOUND));
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

    private static void recipients(List<Finding> out, String section, Step s, RuleSpec spec) {
        if (s.toInvalid()) {
            out.add(error(section, "stepBadRecipients", Map.of(),
                    "Los destinatarios del paso son una lista de identificadores de grupo."));
            return;
        }
        if (s.to().isEmpty()) {
            out.add(error(section, "stepNoRecipients", Map.of(), "Elige a qué grupos escribe el paso."));
        }
        for (String id : s.to()) {
            if (spec.groups().stream().noneMatch(g -> id.equals(g.id()))) {
                out.add(error(section, "stepUnknownGroup", Map.of("id", id), "El grupo " + id + NOT_FOUND));
            }
        }
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
