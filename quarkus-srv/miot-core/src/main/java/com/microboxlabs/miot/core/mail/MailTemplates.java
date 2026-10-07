package com.microboxlabs.miot.core.mail;

import com.microboxlabs.miot.core.mail.MailTemplateEngine.Rendered;
import com.microboxlabs.miot.core.model.MailTemplate;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Email templates, in Handlebars. An organization's template is used first, then the platform's, then the
 * built-in one. Organization ids are those of top-level organizations; null means the platform.
 */
@ApplicationScoped
public class MailTemplates {

    private static final Logger LOG = Logger.getLogger(MailTemplates.class);

    public static final String INVITATION = "invitation";
    public static final List<String> LANGS = List.of("es", "en");
    private static final String ORGANIZATION = "organization";
    private static final String LINK = "link";
    private static final String LOGO_URL = "logoUrl";
    public static final List<String> INVITATION_VARIABLES =
            List.of(ORGANIZATION, "inviter", "email", LINK, "expiresAt", LOGO_URL);

    static final String LOGO_PATH = "/email/modulariot-logo.png";

    private static final Map<String, String> DEFAULT_SUBJECTS = Map.of(
            "es", "Te invitaron a {{organization}}",
            "en", "You're invited to {{organization}}");

    /** Where a template comes from. */
    public enum Source {
        ORGANIZATION, PLATFORM, DEFAULT
    }

    public record TemplateView(String kind, String lang, Source source, String subject, String html,
            Instant updatedAt, String updatedBy, List<String> variables) {
    }

    public record SaveTemplateRequest(String subject, String html) {
    }

    public record PreviewView(String subject, String html) {
    }

    private final MailTemplateEngine engine = new MailTemplateEngine();
    private final Map<String, String> defaultHtml = new HashMap<>();
    private final String logoUrl;

    @Inject
    public MailTemplates(@ConfigProperty(name = "miot.app.public-url") Optional<String> publicUrl) {
        this.logoUrl = publicUrl.map(String::trim).filter(s -> !s.isEmpty())
                .map(url -> (url.endsWith("/") ? url.substring(0, url.length() - 1) : url) + LOGO_PATH)
                .orElse("");
        for (String lang : LANGS) {
            defaultHtml.put(lang, resource("mail-templates/" + INVITATION + "." + lang + ".hbs"));
        }
    }

    /** The ModularIoT logo served by the app, or empty without {@code miot.app.public-url}. */
    public String logoUrl() {
        return logoUrl;
    }

    /** The template used for this scope: its own, else the one it inherits. */
    public Uni<TemplateView> get(Long organizationId, String kind, String lang) {
        check(kind, lang);
        return Panache.withSession(() -> effective(organizationId, kind, lang));
    }

    public Uni<TemplateView> put(Long organizationId, String kind, String lang, SaveTemplateRequest request,
            String actor) {
        check(kind, lang);
        validate(request);
        return Panache.withTransaction(() -> MailTemplate.findFor(organizationId, kind, lang).flatMap(found -> {
            MailTemplate row = found == null ? new MailTemplate() : found;
            row.organizationId = organizationId;
            row.kind = kind;
            row.lang = lang;
            row.subject = request.subject().strip();
            row.html = request.html();
            row.updatedBy = actor;
            row.updatedAt = Instant.now();
            return row.<MailTemplate>persist();
        }))
                .onFailure(MailTemplates::isScopeConflict)
                .transform(e -> new IllegalStateException("The template was saved at the same time; try again"))
                .flatMap(saved -> get(organizationId, kind, lang));
    }

    /** Two first saves of one scope at once: the second breaks the unique index. */
    private static boolean isScopeConflict(Throwable e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (cause.getMessage() != null && cause.getMessage().contains("ux_mail_template_scope")) {
                return true;
            }
        }
        return false;
    }

    /** Removes this scope's own template, so it inherits again. False when it had none. */
    public Uni<Boolean> delete(Long organizationId, String kind, String lang) {
        check(kind, lang);
        return Panache.withTransaction(() -> MailTemplate.findFor(organizationId, kind, lang)
                .flatMap(found -> found == null
                        ? Uni.createFrom().item(false)
                        : found.delete().replaceWith(true)));
    }

    /** Renders an unsaved template with sample values. */
    public PreviewView preview(String kind, String lang, SaveTemplateRequest request, String organization) {
        check(kind, lang);
        validate(request);
        Rendered rendered = engine.render(request.subject(), request.html(), sample(lang, organization));
        return new PreviewView(rendered.subject(), rendered.html());
    }

    /** Writes one email from the values, using the templates loaded for an organization. */
    public interface Renderer {
        Rendered render(Map<String, String> values);
    }

    /**
     * Loads the templates that apply to the organization, once for any number of emails. A template that fails to
     * render falls back to the next one, and a failed lookup to the built-in one, so an invitation is always sent.
     */
    public Uni<Renderer> renderer(Long organizationId, String kind, String lang) {
        check(kind, lang);
        Uni<Renderer> loaded = Panache.withSession(() -> MailTemplate.findFor(organizationId, kind, lang)
                .flatMap(own -> MailTemplate.findFor(null, kind, lang)
                        .map(platform -> rendererOf(own, platform, lang))));
        return loaded.onFailure().recoverWithUni(e -> {
            LOG.warnf(e, "Could not load the %s templates of organization %s, using the built-in one", kind,
                    organizationId);
            return Uni.createFrom().item(builtInRenderer(lang));
        });
    }

    private Renderer rendererOf(MailTemplate own, MailTemplate platform, String lang) {
        return values -> renderFirst(own, platform, lang, values);
    }

    private Renderer builtInRenderer(String lang) {
        return values -> builtIn(lang, values);
    }

    private Rendered renderFirst(MailTemplate own, MailTemplate platform, String lang, Map<String, String> values) {
        Map<String, String> all = withLogo(values);
        for (MailTemplate row : new MailTemplate[] {own, platform}) {
            if (row == null) {
                continue;
            }
            try {
                return engine.render(row.subject, row.html, all);
            } catch (IllegalArgumentException e) {
                LOG.warnf("The %s template %d does not render, using the next one: %s", row.kind, row.id,
                        e.getMessage());
            }
        }
        return builtIn(lang, all);
    }

    /** The built-in template, rendered. */
    Rendered builtIn(String lang, Map<String, String> values) {
        return engine.render(DEFAULT_SUBJECTS.get(lang), defaultHtml.get(lang), withLogo(values));
    }

    private Map<String, String> withLogo(Map<String, String> values) {
        Map<String, String> all = new HashMap<>(values);
        all.putIfAbsent(LOGO_URL, logoUrl);
        return all;
    }

    private Uni<TemplateView> effective(Long organizationId, String kind, String lang) {
        Uni<MailTemplate> own = organizationId == null
                ? Uni.createFrom().nullItem()
                : MailTemplate.findFor(organizationId, kind, lang);
        return own.flatMap(row -> row == null
                ? MailTemplate.findFor(null, kind, lang)
                        .map(platform -> inherited(platform, kind, lang, organizationId == null))
                : Uni.createFrom().item(view(row, Source.ORGANIZATION, true)));
    }

    /** The platform's template, or the built-in one when the platform has none. */
    private TemplateView inherited(MailTemplate platform, String kind, String lang, boolean platformScope) {
        if (platform == null) {
            return new TemplateView(kind, lang, Source.DEFAULT, DEFAULT_SUBJECTS.get(lang), defaultHtml.get(lang),
                    null, null, INVITATION_VARIABLES);
        }
        return view(platform, Source.PLATFORM, platformScope);
    }

    /** Who saved it and when, only when the caller's scope saved it: an organization does not see platform staff. */
    private static TemplateView view(MailTemplate row, Source source, boolean own) {
        return new TemplateView(row.kind, row.lang, source, row.subject, row.html, own ? row.updatedAt : null,
                own ? row.updatedBy : null, INVITATION_VARIABLES);
    }

    /** Parses and renders the template with sample values. It has to contain the invitation link. */
    private void validate(SaveTemplateRequest request) {
        if (request == null || request.subject() == null || request.subject().isBlank()) {
            throw new IllegalArgumentException("subject is required");
        }
        if (request.html() == null || request.html().isBlank()) {
            throw new IllegalArgumentException("html is required");
        }
        if (request.subject().strip().length() > MailTemplateEngine.MAX_SUBJECT) {
            throw new IllegalArgumentException(
                    "The subject is longer than " + MailTemplateEngine.MAX_SUBJECT + " characters");
        }
        if (request.html().length() > MailTemplateEngine.MAX_HTML) {
            throw new IllegalArgumentException(
                    "The body is longer than " + MailTemplateEngine.MAX_HTML + " characters");
        }
        // A link nobody could write into the template, looked for in the text a reader sees.
        String link = "https://example.com/es/invite/" + UUID.randomUUID();
        Map<String, String> values = new HashMap<>(sample("es", "Acme"));
        values.put(LINK, link);
        Rendered rendered = engine.render(request.subject(), request.html(), values);
        if (!rendered.text().contains(link)) {
            throw new IllegalArgumentException("The body has to include the invitation link: {{link}}");
        }
    }

    private Map<String, String> sample(String lang, String organization) {
        boolean english = "en".equals(lang);
        return Map.of(
                ORGANIZATION, organization == null || organization.isBlank() ? "Acme" : organization,
                "inviter", english ? "Jane Doe" : "Ana Pérez",
                "email", english ? "jane@example.com" : "ana@example.com",
                LINK, "https://example.com/" + lang + "/invite/sample-token",
                "expiresAt", date(lang, Instant.now().plus(Duration.ofDays(30))),
                LOGO_URL, logoUrl);
    }

    /** A date as invitations show it: "5 de noviembre de 2026", "November 5, 2026". */
    public static String date(String lang, Instant instant) {
        Locale locale = "en".equals(lang) ? Locale.ENGLISH : Locale.forLanguageTag("es");
        return DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(locale)
                .format(instant.atZone(ZoneOffset.UTC));
    }

    private static void check(String kind, String lang) {
        if (!INVITATION.equals(kind)) {
            throw new IllegalArgumentException("Unknown template: " + kind);
        }
        if (!LANGS.contains(lang)) {
            throw new IllegalArgumentException("Unknown language: " + lang);
        }
    }

    private static String resource(String path) {
        try (InputStream in = MailTemplates.class.getClassLoader().getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Missing " + path);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
