package com.microboxlabs.miot.core.mail;

import com.github.jknack.handlebars.Context;
import com.github.jknack.handlebars.Decorator;
import com.github.jknack.handlebars.EscapingStrategy;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Helper;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.context.MapValueResolver;
import com.github.jknack.handlebars.io.AbstractTemplateLoader;
import com.github.jknack.handlebars.io.TemplateSource;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.Writer;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Renders a Handlebars subject and HTML body. Values are plain strings looked up by name: templates cannot call
 * methods, load or define partials, use helpers that read files, or write a value without escaping it in the body.
 * {@code {{value}}} is HTML-escaped in the body and left as is in the subject. Output is capped at
 * {@link #MAX_OUTPUT} characters.
 */
public final class MailTemplateEngine {

    public static final int MAX_SUBJECT = 255;
    public static final int MAX_HTML = 100_000;
    public static final int MAX_OUTPUT = 500_000;

    /** Built-in helpers that load files or need a JavaScript engine. */
    private static final List<String> DISABLED_HELPERS =
            List.of("partial", "block", "embedded", "precompile", "i18n", "i18nJs", "log");
    /** Forms that write a value without escaping it. */
    private static final List<String> UNESCAPED = List.of("{{{", "{{~{", "{{&", "{{~&");
    private static final int CACHE_SIZE = 256;

    public record Rendered(String subject, String html, String text) {
    }

    private final Handlebars body = configure(new Handlebars(new NoPartials()));
    private final Handlebars subject = configure(new Handlebars(new NoPartials()).with(EscapingStrategy.NOOP));
    private final Map<String, Template> bodies = new ConcurrentHashMap<>();
    private final Map<String, Template> subjects = new ConcurrentHashMap<>();

    /** Throws {@link IllegalArgumentException} when either template does not parse or render. */
    public Rendered render(String subjectTemplate, String htmlTemplate, Map<String, String> values) {
        for (String form : UNESCAPED) {
            if (htmlTemplate.contains(form)) {
                throw new IllegalArgumentException(
                        "The body template is not valid: values must be escaped, use {{value}} instead of " + form);
            }
        }
        String renderedSubject = apply(subject, subjects, subjectTemplate, values, "subject")
                .replaceAll("\\s+", " ").strip();
        String html = apply(body, bodies, htmlTemplate, values, "body");
        return new Rendered(renderedSubject, html, MailText.of(html));
    }

    private static String apply(Handlebars handlebars, Map<String, Template> cache, String source,
            Map<String, String> values, String part) {
        try {
            Template template = cache.get(source);
            if (template == null) {
                template = handlebars.compileInline(source);
                if (cache.size() >= CACHE_SIZE) {
                    cache.clear();
                }
                cache.put(source, template);
            }
            BoundedWriter out = new BoundedWriter();
            template.apply(Context.newBuilder(values).resolver(MapValueResolver.INSTANCE).build(), out);
            return out.toString();
        } catch (IOException | RuntimeException e) {
            throw new IllegalArgumentException("The " + part + " template is not valid: " + e.getMessage(), e);
        }
    }

    private static Handlebars configure(Handlebars handlebars) {
        Helper<Object> disabled = (context, options) -> {
            throw new IllegalArgumentException("The helper " + options.helperName + " is not available");
        };
        DISABLED_HELPERS.forEach(name -> handlebars.registerHelper(name, disabled));
        Decorator noInline = (fn, options) -> {
            throw new IllegalArgumentException("Inline partials are not available");
        };
        handlebars.registerDecorator("inline", noInline);
        return handlebars;
    }

    private static final class NoPartials extends AbstractTemplateLoader {
        @Override
        public TemplateSource sourceAt(String location) throws IOException {
            throw new FileNotFoundException("Partials are not available: " + location);
        }
    }

    /** Fails once the output passes {@link #MAX_OUTPUT} characters. */
    private static final class BoundedWriter extends Writer {
        private final StringBuilder out = new StringBuilder();

        @Override
        public void write(char[] buffer, int offset, int length) throws IOException {
            if (out.length() + length > MAX_OUTPUT) {
                throw new IOException("the output is longer than " + MAX_OUTPUT + " characters");
            }
            out.append(buffer, offset, length);
        }

        @Override
        public void flush() {
            // Nothing is buffered outside the builder.
        }

        @Override
        public void close() {
            // Nothing to release.
        }

        @Override
        public String toString() {
            return out.toString();
        }
    }
}
