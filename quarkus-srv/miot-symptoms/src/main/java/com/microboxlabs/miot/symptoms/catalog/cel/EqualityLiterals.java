package com.microboxlabs.miot.symptoms.catalog.cel;

import java.util.ArrayList;
import java.util.List;
import java.util.function.IntPredicate;

/**
 * Writes the integer literals compared with {@code ==} or {@code !=} as
 * doubles. Source numbers are doubles, and CEL checks {@code _==_} only
 * between equal types, so {@code measure == 0} fails while
 * {@code measure >= 0} passes.
 *
 * @param text     the rule to compile
 * @param inserted offsets in {@code text} where ".0" was added, ascending
 */
record EqualityLiterals(String text, List<Integer> inserted) {

    private static final String DECIMAL = ".0";

    static EqualityLiterals of(String rule) {
        return of(rule, operator -> true);
    }

    /**
     * Only the integers next to an operator the predicate accepts, given the
     * operator's offset in the rule.
     */
    static EqualityLiterals of(String rule, IntPredicate operator) {
        StringBuilder out = new StringBuilder(rule.length() + 8);
        List<Integer> inserted = new ArrayList<>();
        int i = 0;
        while (i < rule.length()) {
            char c = rule.charAt(i);
            if (c == '"' || c == '\'') {
                int end = stringEnd(rule, i);
                out.append(rule, i, end);
                i = end;
            } else if (Character.isDigit(c) && !partOfName(rule, i)) {
                int end = numberEnd(rule, i);
                out.append(rule, i, end);
                if (isInteger(rule, i, end) && isEquality(equalityOperator(rule, i, end), operator)) {
                    inserted.add(out.length());
                    out.append(DECIMAL);
                }
                i = end;
            } else {
                out.append(c);
                i++;
            }
        }
        return new EqualityLiterals(out.toString(), List.copyOf(inserted));
    }

    /** The offset in the rule as written of an offset in {@link #text}. */
    int original(int offset) {
        int shift = 0;
        for (int at : inserted) {
            if (at < offset) {
                shift += Math.min(DECIMAL.length(), offset - at);
            }
        }
        return offset - shift;
    }

    private static int stringEnd(String rule, int start) {
        char quote = rule.charAt(start);
        int i = start + 1;
        while (i < rule.length() && rule.charAt(i) != quote) {
            i += rule.charAt(i) == '\\' ? 2 : 1;
        }
        return Math.min(rule.length(), i + 1);
    }

    private static boolean partOfName(String rule, int i) {
        if (i == 0) {
            return false;
        }
        char before = rule.charAt(i - 1);
        return Character.isLetterOrDigit(before) || before == '_' || before == '.';
    }

    private static int numberEnd(String rule, int start) {
        int i = start;
        while (i < rule.length() && (Character.isLetterOrDigit(rule.charAt(i)) || rule.charAt(i) == '.'
                || ((rule.charAt(i) == '+' || rule.charAt(i) == '-') && isExponent(rule, i - 1)))) {
            i++;
        }
        return i;
    }

    private static boolean isExponent(String rule, int i) {
        return i >= 0 && (rule.charAt(i) == 'e' || rule.charAt(i) == 'E');
    }

    private static boolean isInteger(String rule, int start, int end) {
        for (int i = start; i < end; i++) {
            if (!Character.isDigit(rule.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    private static boolean isEquality(int at, IntPredicate operator) {
        return at >= 0 && operator.test(at);
    }

    /** Offset of the == or != the number is compared with, or -1. */
    private static int equalityOperator(String rule, int start, int end) {
        int before = start - 1;
        while (before >= 0 && Character.isWhitespace(rule.charAt(before))) {
            before--;
        }
        if (before >= 0 && rule.charAt(before) == '-') {
            before--;
            while (before >= 0 && Character.isWhitespace(rule.charAt(before))) {
                before--;
            }
        }
        if (before >= 1 && isEqualityOperator(rule, before - 1)) {
            return before - 1;
        }
        int after = end;
        while (after < rule.length() && Character.isWhitespace(rule.charAt(after))) {
            after++;
        }
        return after + 1 < rule.length() && isEqualityOperator(rule, after) ? after : -1;
    }

    private static boolean isEqualityOperator(String rule, int i) {
        return rule.charAt(i + 1) == '=' && (rule.charAt(i) == '=' || rule.charAt(i) == '!');
    }
}
