package com.microboxlabs.miot.core.mail;

import java.util.Locale;
import java.util.Set;

/** The plain-text part of an HTML email: its visible text, one line per block, with link targets after links. */
final class MailText {

    private static final Set<String> HIDDEN = Set.of("head", "style", "script", "title");
    private static final Set<String> BLOCKS =
            Set.of("br", "p", "div", "tr", "table", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "hr");

    private MailText() {
    }

    static String of(String html) {
        StringBuilder out = new StringBuilder();
        int linkStart = -1;
        String href = null;
        int i = 0;
        while (i < html.length()) {
            int open = html.indexOf('<', i);
            if (open < 0) {
                out.append(html, i, html.length());
                break;
            }
            out.append(html, i, open);
            int close = html.indexOf('>', open);
            if (close < 0) {
                break;
            }
            String tag = html.substring(open + 1, close);
            String name = tagName(tag);
            i = close + 1;
            if (HIDDEN.contains(name)) {
                int end = html.toLowerCase(Locale.ROOT).indexOf("</" + name, i);
                int endClose = end < 0 ? -1 : html.indexOf('>', end);
                i = endClose < 0 ? html.length() : endClose + 1;
            } else if ("a".equals(name)) {
                href = attribute(tag, "href");
                linkStart = out.length();
            } else if ("/a".equals(name)) {
                appendTarget(out, linkStart, href);
                href = null;
            } else if (BLOCKS.contains(name.startsWith("/") ? name.substring(1) : name)) {
                out.append('\n');
            }
        }
        return tidy(decode(out.toString()));
    }

    /** Appends " (href)" after a link whose text is not already the address. */
    private static void appendTarget(StringBuilder out, int linkStart, String href) {
        if (href == null || href.isBlank() || linkStart < 0) {
            return;
        }
        String label = decode(out.substring(linkStart)).strip();
        String target = decode(href).strip();
        if (!label.equals(target)) {
            out.append(" (").append(href.strip()).append(')');
        }
    }

    private static String tagName(String tag) {
        int end = tag.startsWith("/") ? 1 : 0;
        while (end < tag.length() && Character.isLetterOrDigit(tag.charAt(end))) {
            end++;
        }
        return tag.substring(0, end).toLowerCase(Locale.ROOT);
    }

    private static String attribute(String tag, String name) {
        String lower = tag.toLowerCase(Locale.ROOT);
        int at = lower.indexOf(name + "=");
        if (at < 0) {
            return null;
        }
        int start = at + name.length() + 1;
        if (start >= tag.length()) {
            return null;
        }
        char quote = tag.charAt(start);
        if (quote == '"' || quote == '\'') {
            int end = tag.indexOf(quote, start + 1);
            return end < 0 ? null : tag.substring(start + 1, end);
        }
        int end = start;
        while (end < tag.length() && !Character.isWhitespace(tag.charAt(end))) {
            end++;
        }
        return tag.substring(start, end);
    }

    private static String decode(String text) {
        return text.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
                .replace("&#39;", "'").replace("&#x27;", "'").replace("&#x3D;", "=").replace("&#x60;", "`")
                .replace("&amp;", "&");
    }

    /** Trims each line, joins runs of spaces and keeps at most one blank line in a row. */
    private static String tidy(String text) {
        StringBuilder out = new StringBuilder();
        boolean blank = true;
        for (String line : text.split("\n", -1)) {
            String clean = String.join(" ", line.strip().split("\\s+"));
            if (clean.isEmpty()) {
                if (!blank) {
                    out.append('\n');
                }
                blank = true;
            } else {
                out.append(clean).append('\n');
                blank = false;
            }
        }
        return out.toString().strip() + "\n";
    }
}
