package com.microboxlabs.miot.core.mail;

import com.microboxlabs.miot.core.mail.MailTemplateEngine.Rendered;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Emails written from a message template: the template's HTML body, rendered with {@link MailTemplateEngine}
 * (values escaped), inside the ModularIoT layout with the logo and footer.
 */
@ApplicationScoped
public class NotificationMail {

    static final String CONTENT = "<!-- content -->";
    private static final String LAYOUT_RESOURCE = "mail-templates/notification.hbs";

    private static final MailTemplateEngine ENGINE = new MailTemplateEngine();

    private final String layout;
    private final String logoUrl;
    private final String appUrl;

    @Inject
    public NotificationMail(@ConfigProperty(name = "miot.app.public-url") Optional<String> publicUrl,
            MailTemplates templates) {
        this.layout = resource();
        this.logoUrl = templates.logoUrl();
        this.appUrl = publicUrl.map(String::trim).filter(s -> !s.isEmpty())
                .map(url -> url.endsWith("/") ? url.substring(0, url.length() - 1) : url).orElse("");
    }

    /**
     * The template's subject and HTML body with the values in. The text is the body's, for the conversation
     * history and the plain-text part.
     *
     * @throws IllegalArgumentException when either does not parse or render
     */
    public static Rendered body(String subject, String html, Map<String, String> values) {
        return ENGINE.render(subject, html, values);
    }

    /** The whole email: the rendered body inside the layout. */
    public String wrap(String subject, String bodyHtml) {
        String page = ENGINE.render("", layout, Map.of("subject", subject == null ? "" : subject,
                "logoUrl", logoUrl)).html();
        return page.replace(CONTENT, bodyHtml == null ? "" : bodyHtml);
    }

    /** The app's address, as {@code https://host/app}, or empty without {@code miot.app.public-url}. */
    public String appUrl() {
        return appUrl;
    }

    private static String resource() {
        try (InputStream in = NotificationMail.class.getClassLoader().getResourceAsStream(LAYOUT_RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("Missing " + LAYOUT_RESOURCE);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
