package com.microboxlabs.miot.conversational.rules;

import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * How much saving a template changes it, in the bumps rules use. MAJOR: it loses a channel, its variables change,
 * or its WhatsApp variant sends another Meta template. MINOR: it gains a channel. PATCH: only its name or texts.
 */
public final class TemplateBump {

    private static final Pattern VARIABLE = Pattern.compile("\\{\\{\\s*([A-Za-z0-9_.]+)\\s*}}");

    private TemplateBump() {
    }

    /** The bump from {@code before} to {@code after}; null when they are the same. */
    public static RuleBump between(ConvTemplate before, ConvTemplate after) {
        boolean lostChannel = (before.whatsapp() != null && after.whatsapp() == null)
                || (before.email() != null && after.email() == null);
        if (lostChannel || !variables(before).equals(variables(after)) || otherMetaTemplate(before, after)) {
            return RuleBump.MAJOR;
        }
        if ((before.whatsapp() == null && after.whatsapp() != null)
                || (before.email() == null && after.email() != null)) {
            return RuleBump.MINOR;
        }
        boolean same = Objects.equals(before.name(), after.name())
                && Objects.equals(before.baseText(), after.baseText())
                && Objects.equals(before.whatsapp(), after.whatsapp())
                && Objects.equals(before.email(), after.email());
        return same ? null : RuleBump.PATCH;
    }

    /** The variables the template reads: {@code {{x}}} in its texts and its WhatsApp parameters. */
    static Set<String> variables(ConvTemplate t) {
        Set<String> out = new TreeSet<>();
        collect(t.baseText(), out);
        if (t.email() != null) {
            collect(t.email().subject(), out);
            collect(t.email().body(), out);
            collect(t.email().html(), out);
        }
        if (t.whatsapp() != null) {
            out.addAll(t.whatsapp().params());
        }
        return out;
    }

    private static boolean otherMetaTemplate(ConvTemplate before, ConvTemplate after) {
        return before.whatsapp() != null && after.whatsapp() != null
                && (!Objects.equals(before.whatsapp().metaName(), after.whatsapp().metaName())
                        || !Objects.equals(before.whatsapp().language(), after.whatsapp().language()));
    }

    private static void collect(String text, Set<String> out) {
        if (text == null) {
            return;
        }
        Matcher m = VARIABLE.matcher(text);
        while (m.find()) {
            out.add(m.group(1));
        }
    }
}
