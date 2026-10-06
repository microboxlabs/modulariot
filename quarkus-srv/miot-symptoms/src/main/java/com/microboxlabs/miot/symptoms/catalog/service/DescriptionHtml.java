package com.microboxlabs.miot.symptoms.catalog.service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Keeps bare {@code <b>}, {@code <i>} and {@code <mark>} tags and escapes
 * everything else. Character references such as {@code &lt;} are kept,
 * so sanitizing twice changes nothing. Text is capped at
 * {@value #MAX_CHARS} characters and tags left open are closed. Same
 * rules as the Harness sanitizer.
 */
final class DescriptionHtml {

    static final int MAX_CHARS = 600;
    private static final Set<String> ALLOWED = Set.of("b", "i", "mark");
    private static final Pattern TAG = Pattern.compile("<(/?)([a-zA-Z]+)>");
    private static final Pattern ENTITY = Pattern.compile("&(?:[a-zA-Z]{2,8}|#\\d{1,6}|#x[0-9a-fA-F]{1,6});");

    private DescriptionHtml() {
    }

    static String sanitize(String text) {
        if (text == null) {
            return "";
        }
        String in = text.strip();
        StringBuilder out = new StringBuilder();
        Deque<String> open = new ArrayDeque<>();
        int[] length = {0};
        int pos = 0;
        Matcher m = TAG.matcher(in);
        while (m.find()) {
            appendText(out, in.substring(pos, m.start()), length);
            pos = m.end();
            boolean closing = !m.group(1).isEmpty();
            String name = m.group(2).toLowerCase(Locale.ROOT);
            if (!ALLOWED.contains(name)) {
                appendText(out, m.group(), length);
            } else if (!closing) {
                out.append('<').append(name).append('>');
                open.push(name);
            } else if (open.contains(name)) {
                while (!open.isEmpty()) {
                    String tag = open.pop();
                    out.append("</").append(tag).append('>');
                    if (tag.equals(name)) {
                        break;
                    }
                }
            }
        }
        appendText(out, in.substring(pos), length);
        while (!open.isEmpty()) {
            out.append("</").append(open.pop()).append('>');
        }
        return out.toString().strip();
    }

    private static void appendText(StringBuilder out, String chunk, int[] length) {
        Matcher entity = ENTITY.matcher(chunk);
        int i = 0;
        while (i < chunk.length() && length[0] < MAX_CHARS) {
            if (chunk.charAt(i) == '&' && entity.region(i, chunk.length()).lookingAt()) {
                out.append(entity.group());
                i = entity.end();
            } else {
                // Count code points, as the Harness does, so a surrogate pair is never split.
                int c = chunk.codePointAt(i);
                i += Character.charCount(c);
                switch (c) {
                    case '<' -> out.append("&lt;");
                    case '>' -> out.append("&gt;");
                    case '&' -> out.append("&amp;");
                    default -> out.appendCodePoint(c);
                }
            }
            length[0]++;
        }
    }
}
