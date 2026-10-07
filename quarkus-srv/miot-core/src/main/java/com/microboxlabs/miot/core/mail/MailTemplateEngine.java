package com.microboxlabs.miot.core.mail;

import com.github.jknack.handlebars.Context;
import com.github.jknack.handlebars.EscapingStrategy;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Helper;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.context.MapValueResolver;
import com.github.jknack.handlebars.io.AbstractTemplateLoader;
import com.github.jknack.handlebars.io.TemplateSource;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Renders a Handlebars subject and HTML body. Values are plain strings looked up by name: templates cannot call
 * methods, load partials or use helpers that read files. {@code {{value}}} is HTML-escaped in the body and left as
 * is in the subject.
 */
public final class MailTemplateEngine {

    public static final int MAX_SUBJECT = 255;
    public static final int MAX_HTML = 100_000;

    /** Built-in helpers that load files or need a JavaScript engine. */
    private static final List<String> DISABLED_HELPERS =
            List.of("partial", "block", "embedded", "precompile", "i18n", "i18nJs", "log");

    public record Rendered(String subject, String html, String text) {
    }

    private final Handlebars body = configure(new Handlebars(new NoPartials()));
    private final Handlebars subject = configure(new Handlebars(new NoPartials()).with(EscapingStrategy.NOOP));

    /** Throws {@link IllegalArgumentException} when either template does not parse or render. */
    public Rendered render(String subjectTemplate, String htmlTemplate, Map<String, String> values) {
        String renderedSubject = apply(subject, subjectTemplate, values, "subject")
                .replaceAll("\\s+", " ").strip();
        String html = apply(body, htmlTemplate, values, "body");
        return new Rendered(renderedSubject, html, MailText.of(html));
    }

    private static String apply(Handlebars handlebars, String source, Map<String, String> values, String part) {
        try {
            Template template = handlebars.compileInline(source);
            return template.apply(Context.newBuilder(values).resolver(MapValueResolver.INSTANCE).build());
        } catch (IOException | RuntimeException e) {
            throw new IllegalArgumentException("The " + part + " template is not valid: " + e.getMessage(), e);
        }
    }

    private static Handlebars configure(Handlebars handlebars) {
        Helper<Object> disabled = (context, options) -> {
            throw new IllegalArgumentException("The helper " + options.helperName + " is not available");
        };
        DISABLED_HELPERS.forEach(name -> handlebars.registerHelper(name, disabled));
        return handlebars;
    }

    private static final class NoPartials extends AbstractTemplateLoader {
        @Override
        public TemplateSource sourceAt(String location) throws IOException {
            throw new FileNotFoundException("Partials are not available: " + location);
        }
    }
}
