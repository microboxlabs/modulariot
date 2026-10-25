package com.microboxlabs.miot.conversational.rules;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * How much a publish changes a rule, and so its next semantic version. MAJOR: the event. MINOR: the condition,
 * the recipients, a step added, removed or moved, or a step's channel, recipients or connection. PATCH: only a step's
 * minutes, template or what it does on a reply, or the family. Declared from smallest to largest.
 */
public enum RuleBump {
    PATCH,
    MINOR,
    MAJOR;

    /** A rule's first published version. */
    public static final String FIRST = "0.1.0";

    /** The bump from {@code before} to {@code after}; null when they do the same. */
    public static RuleBump between(RuleSpec before, RuleSpec after) {
        if (!Objects.equals(event(before), event(after))) {
            return MAJOR;
        }
        if (!Objects.equals(when(before), when(after)) || !before.audience().equals(after.audience())
                || stepsMovedOrRerouted(before.steps(), after.steps())) {
            return MINOR;
        }
        return before.steps().equals(after.steps()) && Objects.equals(before.family(), after.family()) ? null
                : PATCH;
    }

    /** The version after {@code current} for this bump; {@link #FIRST} when nothing is published yet. */
    public String next(String current) {
        if (current == null) {
            return FIRST;
        }
        String[] parts = current.split("\\.");
        if (parts.length != 3) {
            throw new IllegalStateException("Not a semantic version: " + current);
        }
        int major = Integer.parseInt(parts[0]);
        int minor = Integer.parseInt(parts[1]);
        int patch = Integer.parseInt(parts[2]);
        return switch (this) {
            case MAJOR -> (major + 1) + ".0.0";
            case MINOR -> major + "." + (minor + 1) + ".0";
            case PATCH -> major + "." + minor + "." + (patch + 1);
        };
    }

    /** This bump, raised to {@code requested} when that is larger; a requested bump never lowers it. */
    public RuleBump atLeast(RuleBump requested) {
        return requested == null || compareTo(requested) >= 0 ? this : requested;
    }

    private static boolean stepsMovedOrRerouted(List<RuleSpec.Step> before, List<RuleSpec.Step> after) {
        if (before.size() != after.size()) {
            return true;
        }
        for (int i = 0; i < before.size(); i++) {
            RuleSpec.Step a = before.get(i);
            RuleSpec.Step b = after.get(i);
            if (!Objects.equals(a.channel(), b.channel()) || !Objects.equals(a.to(), b.to())
                    || a.toInvalid() != b.toInvalid() || !Objects.equals(a.connection(), b.connection())) {
                return true;
            }
        }
        // Same steps in another order.
        return !before.equals(after) && sorted(before).equals(sorted(after));
    }

    private static List<RuleSpec.Step> sorted(List<RuleSpec.Step> steps) {
        return steps.stream().sorted(Comparator.comparing(RuleSpec.Step::toString)).toList();
    }

    private static String event(RuleSpec spec) {
        return spec.trigger() == null ? null : spec.trigger().event();
    }

    /** The condition with whitespace outside quotes collapsed, as the app compares it; blank is no condition. */
    private static String when(RuleSpec spec) {
        return spec.trigger() == null ? "" : squash(spec.trigger().when());
    }

    static String squash(String s) {
        String text = s == null ? "" : s.strip();
        StringBuilder out = new StringBuilder(text.length());
        boolean space = false;
        int i = 0;
        while (i < text.length()) {
            char c = text.charAt(i);
            if (Character.isWhitespace(c)) {
                space = true;
                i++;
                continue;
            }
            if (space) {
                out.append(' ');
            }
            space = false;
            int end = c == '\'' || c == '"' ? quotedEnd(text, i) : i + 1;
            out.append(text, i, end);
            i = end;
        }
        return out.toString();
    }

    /** Where the quoted text starting at {@code start} ends, past its closing quote; a backslash escapes. */
    private static int quotedEnd(String text, int start) {
        char quote = text.charAt(start);
        int i = start + 1;
        while (i < text.length()) {
            char c = text.charAt(i);
            if (c == quote) {
                return i + 1;
            }
            i += c == '\\' ? 2 : 1;
        }
        return text.length();
    }
}
