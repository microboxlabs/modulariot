package com.microboxlabs.miot.core.mail;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** The plain-text part of an HTML email: its visible text, one line per block, with link targets after links. */
final class MailText {

    private static final Set<String> HIDDEN = Set.of("head", "style", "script", "title");
    private static final Set<String> BLOCKS = Set.of("br", "p", "div", "tr", "td", "th", "table", "li", "ul",
            "ol", "h1", "h2", "h3", "h4", "h5", "h6", "hr");
    private static final Map<String, String> ENTITIES = Map.ofEntries(
            Map.entry("nbsp", " "), Map.entry("amp", "&"), Map.entry("lt", "<"), Map.entry("gt", ">"),
            Map.entry("quot", "\""), Map.entry("apos", "'"), Map.entry("copy", "©"), Map.entry("reg", "®"),
            Map.entry("aacute", "á"), Map.entry("eacute", "é"), Map.entry("iacute", "í"),
            Map.entry("oacute", "ó"), Map.entry("uacute", "ú"), Map.entry("Aacute", "Á"),
            Map.entry("Eacute", "É"), Map.entry("Iacute", "Í"), Map.entry("Oacute", "Ó"),
            Map.entry("Uacute", "Ú"), Map.entry("ntilde", "ñ"), Map.entry("Ntilde", "Ñ"),
            Map.entry("uuml", "ü"), Map.entry("Uuml", "Ü"), Map.entry("iexcl", "¡"), Map.entry("iquest", "¿"),
            Map.entry("laquo", "«"), Map.entry("raquo", "»"), Map.entry("ndash", "–"), Map.entry("mdash", "—"),
            Map.entry("hellip", "…"), Map.entry("middot", "·"));
    private static final int MAX_ENTITY = 10;

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
            if (html.startsWith("<!--", open)) {
                int end = html.indexOf("-->", open + 4);
                i = end < 0 ? html.length() : end + 3;
                continue;
            }
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

    /** The value of one attribute, reading the attributes in order as HTML does. */
    static String attribute(String tag, String wanted) {
        int i = tagName(tag).length();
        while (i < tag.length()) {
            while (i < tag.length() && (Character.isWhitespace(tag.charAt(i)) || tag.charAt(i) == '/')) {
                i++;
            }
            int nameStart = i;
            while (i < tag.length() && !Character.isWhitespace(tag.charAt(i)) && tag.charAt(i) != '='
                    && tag.charAt(i) != '/') {
                i++;
            }
            String name = tag.substring(nameStart, i);
            if (name.isEmpty()) {
                return null;
            }
            while (i < tag.length() && Character.isWhitespace(tag.charAt(i))) {
                i++;
            }
            String value = "";
            if (i < tag.length() && tag.charAt(i) == '=') {
                i++;
                while (i < tag.length() && Character.isWhitespace(tag.charAt(i))) {
                    i++;
                }
                int valueEnd = valueEnd(tag, i);
                value = unquote(tag.substring(i, valueEnd));
                i = valueEnd;
            }
            if (name.equalsIgnoreCase(wanted)) {
                return value;
            }
        }
        return null;
    }

    private static int valueEnd(String tag, int start) {
        if (start < tag.length() && (tag.charAt(start) == '"' || tag.charAt(start) == '\'')) {
            int close = tag.indexOf(tag.charAt(start), start + 1);
            return close < 0 ? tag.length() : close + 1;
        }
        int end = start;
        while (end < tag.length() && !Character.isWhitespace(tag.charAt(end))) {
            end++;
        }
        return end;
    }

    private static String unquote(String value) {
        if (value.length() >= 2 && (value.charAt(0) == '"' || value.charAt(0) == '\'')
                && value.charAt(value.length() - 1) == value.charAt(0)) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    /** Decodes numeric entities and the common named ones; anything else is left as written. */
    private static String decode(String text) {
        StringBuilder out = new StringBuilder(text.length());
        int i = 0;
        while (i < text.length()) {
            int amp = text.indexOf('&', i);
            if (amp < 0) {
                out.append(text, i, text.length());
                break;
            }
            out.append(text, i, amp);
            int semi = text.indexOf(';', amp + 1);
            String decoded = semi < 0 || semi - amp > MAX_ENTITY ? null : entity(text.substring(amp + 1, semi));
            if (decoded == null) {
                out.append('&');
                i = amp + 1;
            } else {
                out.append(decoded);
                i = semi + 1;
            }
        }
        return out.toString();
    }

    private static String entity(String name) {
        if (name.startsWith("#")) {
            try {
                int code = name.startsWith("#x") || name.startsWith("#X")
                        ? Integer.parseInt(name.substring(2), 16)
                        : Integer.parseInt(name.substring(1));
                return Character.isValidCodePoint(code) ? Character.toString(code) : null;
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return ENTITIES.get(name);
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
