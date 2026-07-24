package com.microboxlabs.miot.integrations.template;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The payload template language: literal text interleaved with {@code {{dotted.path}}}
 * variables, resolved against a context of {@code {task, content, review, session}}.
 *
 * <p><b>Deliberately a strict subset of Handlebars.</b> The settings UI previews templates
 * with the real engine, so anything this cannot reproduce identically — blocks
 * ({@code {{#if}}}, {@code {{#each}}}), helpers ({@code {{formatDate x}}}), partials,
 * comments, unescaped stashes — is <b>rejected at save time</b> rather than rendered
 * differently in production. That is the whole point: preview and runtime cannot drift,
 * because a template they would disagree about is never stored.
 *
 * <p>Escaping is intentionally absent. Values go into a JSON body built by Jackson, which
 * does its own escaping; HTML-escaping them here would corrupt the payload.
 *
 * <p>If helpers are wanted later, add a real Handlebars dependency and relax
 * {@link #validate} — do not let the two sides diverge in the meantime.
 */
public final class PayloadTemplate {

    /** The context objects a template may read. */
    public static final Set<String> DEFAULT_ROOTS = Set.of("task", "content", "review", "session");

    private PayloadTemplate() {
    }

    /** One piece of a parsed template: either literal text or a variable path. */
    record Node(String text, boolean variable) {
    }

    /**
     * Checks the template renders identically here and in the UI's engine, and that every
     * variable it reads exists.
     *
     * @param allowedRoots the context objects in scope; typically {@link #DEFAULT_ROOTS}
     * @return every path the template references, for callers that want to report them
     * @throws TemplateSyntaxException naming the construct or root at fault
     */
    public static Set<String> validate(String template, Set<String> allowedRoots) {
        Set<String> paths = new LinkedHashSet<>();
        for (Node node : parse(template)) {
            if (!node.variable()) {
                continue;
            }
            String path = node.text();
            String root = path.contains(".") ? path.substring(0, path.indexOf('.')) : path;
            if (!allowedRoots.contains(root)) {
                throw new TemplateSyntaxException("Unknown variable '" + path + "': '" + root
                        + "' is not one of " + new java.util.TreeSet<>(allowedRoots));
            }
            if (!path.contains(".")) {
                // {{task}} would stringify a whole object into the payload; almost certainly
                // a half-typed path rather than an intent.
                throw new TemplateSyntaxException(
                        "Variable '" + path + "' is a whole object; use one of its fields, e.g. '"
                                + path + ".someField'");
            }
            paths.add(path);
        }
        return paths;
    }

    /**
     * Substitutes each variable with its context value. A path that resolves to nothing
     * becomes the empty string — a missing optional value is normal, and
     * {@code PayloadRenderer} decides whether an empty result may be sent.
     */
    public static String render(String template, Map<String, Object> context) {
        StringBuilder out = new StringBuilder();
        for (Node node : parse(template)) {
            out.append(node.variable() ? resolveToString(node.text(), context) : node.text());
        }
        return out.toString();
    }

    /**
     * Whether the template is exactly one variable and nothing else, so the caller can use
     * the context value's own type instead of its string form.
     */
    public static boolean isSingleVariable(String template) {
        List<Node> nodes = parse(template);
        return nodes.size() == 1 && nodes.get(0).variable();
    }

    /** The raw context value a single-variable template points at, or null. */
    public static Object resolve(String path, Map<String, Object> context) {
        Object current = context;
        for (String segment : path.split("\\.")) {
            if (!(current instanceof Map<?, ?> map)) {
                return null;
            }
            current = map.get(segment);
            if (current == null) {
                return null;
            }
        }
        return current;
    }

    private static String resolveToString(String path, Map<String, Object> context) {
        Object value = resolve(path, context);
        return value == null ? "" : String.valueOf(value);
    }

    /**
     * Splits a template into literal and variable nodes, rejecting every construct outside
     * the supported subset.
     */
    static List<Node> parse(String template) {
        List<Node> nodes = new ArrayList<>();
        if (template == null || template.isEmpty()) {
            return nodes;
        }
        int cursor = 0;
        while (cursor < template.length()) {
            int open = template.indexOf("{{", cursor);
            if (open < 0) {
                nodes.add(new Node(template.substring(cursor), false));
                break;
            }
            if (open > cursor) {
                nodes.add(new Node(template.substring(cursor, open), false));
            }
            // {{{raw}}} skips escaping in Handlebars. We never escape, so accepting it would
            // quietly mean something different from what the preview showed.
            if (template.startsWith("{{{", open)) {
                throw new TemplateSyntaxException(
                        "Unescaped '{{{ }}}' is not supported; use '{{ }}'");
            }
            int close = template.indexOf("}}", open + 2);
            if (close < 0) {
                throw new TemplateSyntaxException(
                        "Unclosed '{{' — every variable must end with '}}'");
            }
            nodes.add(new Node(requirePath(template.substring(open + 2, close)), true));
            cursor = close + 2;
        }
        return nodes;
    }

    /** @throws TemplateSyntaxException when the stash is a block, helper, partial or comment */
    private static String requirePath(String rawInner) {
        String inner = rawInner.trim();
        if (inner.isEmpty()) {
            throw new TemplateSyntaxException("Empty '{{}}' is not a variable");
        }
        char first = inner.charAt(0);
        // # block, / close, ^ inverted, > partial, ! comment, & unescaped, = delimiters
        if ("#/^>!&=".indexOf(first) >= 0) {
            throw new TemplateSyntaxException("'{{" + inner + "}}' is not supported — this field "
                    + "takes plain variables like '{{task.serviceCode}}', not blocks, partials or comments");
        }
        for (int i = 0; i < inner.length(); i++) {
            if (Character.isWhitespace(inner.charAt(i))) {
                throw new TemplateSyntaxException("'{{" + inner + "}}' looks like a helper call; "
                        + "only plain variables such as '{{review.verdict}}' are supported");
            }
        }
        if (inner.startsWith(".") || inner.endsWith(".") || inner.contains("..")) {
            throw new TemplateSyntaxException("'{{" + inner + "}}' is not a valid variable path");
        }
        for (int i = 0; i < inner.length(); i++) {
            char c = inner.charAt(i);
            if (!Character.isLetterOrDigit(c) && c != '_' && c != '.') {
                throw new TemplateSyntaxException(
                        "'{{" + inner + "}}' contains an unsupported character '" + c + "'");
            }
        }
        return inner;
    }
}
