package com.microboxlabs.miot.symptoms.catalog.cel;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** CEL error messages as {@link RuleMessage} codes. Unknown messages keep the CEL text as {@code ruleCel}. */
final class RuleMessages {

    private static final Pattern OVERLOAD =
            Pattern.compile("found no matching overload for '_?([^_']+)_?' applied to '\\(([^,)]+)(?:, ([^)]+))?\\)'");
    private static final Pattern UNDEFINED_FIELD = Pattern.compile("undefined field '([^']+)'");
    private static final Pattern UNDECLARED = Pattern.compile("undeclared reference to '([^']+)'");
    private static final Pattern MISMATCHED = Pattern.compile("mismatched input '([^']+)'");
    private static final Pattern EXTRANEOUS = Pattern.compile("(?:extraneous|no viable alternative at) input '([^']+)'");

    private RuleMessages() {
    }

    static RuleMessage plain(String message) {
        if (message == null) {
            return RuleMessage.of("ruleInvalid");
        }
        Matcher m = OVERLOAD.matcher(message);
        if (m.find()) {
            String left = type(m.group(2));
            return m.group(3) == null
                    ? RuleMessage.of("ruleOperator", "op", m.group(1), "left", left)
                    : RuleMessage.of("ruleOperatorBetween", "op", m.group(1), "left", left, "right", type(m.group(3)));
        }
        m = UNDEFINED_FIELD.matcher(message);
        if (m.find()) {
            return RuleMessage.of("ruleNoField", "field", m.group(1));
        }
        m = UNDECLARED.matcher(message);
        if (m.find()) {
            return RuleMessage.of("ruleNoName", "name", m.group(1));
        }
        m = MISMATCHED.matcher(message);
        if (m.find()) {
            return "<EOF>".equals(m.group(1))
                    ? RuleMessage.of("ruleIncomplete")
                    : RuleMessage.of("ruleUnexpected", "symbol", m.group(1));
        }
        m = EXTRANEOUS.matcher(message);
        if (m.find()) {
            return RuleMessage.of("ruleUnexpected", "symbol", m.group(1));
        }
        return RuleMessage.of("ruleCel", "detail", message);
    }

    private static String type(String cel) {
        String t = cel.trim();
        return t.startsWith("T_") ? "object" : t;
    }
}
