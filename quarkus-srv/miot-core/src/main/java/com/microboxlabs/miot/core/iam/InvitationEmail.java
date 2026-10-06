package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.mail.Mail;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.Locale;

/** The invitation email, in Spanish or English. Every value is escaped in the HTML part. */
final class InvitationEmail {

    private InvitationEmail() {
    }

    static Mail of(String lang, String to, String organization, String inviter, String link, Instant expiresAt) {
        boolean english = "en".equals(lang);
        Locale locale = english ? Locale.ENGLISH : Locale.forLanguageTag("es");
        String expires = DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(locale)
                .format(expiresAt.atZone(ZoneOffset.UTC));
        String subject = english ? "You're invited to " + organization : "Te invitaron a " + organization;
        String intro = english
                ? inviter + " invited you to join " + organization + "."
                : inviter + " te invitó a unirte a " + organization + ".";
        String action = english
                ? "To accept, open this link and sign in with " + to + ":"
                : "Para aceptar, abre este enlace e inicia sesión con " + to + ":";
        String button = english ? "Accept the invitation" : "Aceptar la invitación";
        String footer = english
                ? "The invitation expires on " + expires + ". If you did not expect this email, you can ignore it."
                : "La invitación vence el " + expires + ". Si no esperabas este correo, puedes ignorarlo.";

        String text = intro + "\n\n" + action + "\n" + link + "\n\n" + footer + "\n";
        String html = """
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111827">
                <p>%s</p>
                <p>%s</p>
                <p><a href="%s" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#ffffff;\
                text-decoration:none;border-radius:6px">%s</a></p>
                <p style="font-size:13px;color:#4b5563">%s</p>
                <p style="font-size:13px;color:#4b5563;word-break:break-all">%s</p>
                </div>
                """.formatted(escape(intro), escape(action), escape(link), escape(button), escape(footer),
                escape(link));
        return new Mail(to, subject, text, html);
    }

    static String escape(String value) {
        StringBuilder out = new StringBuilder(value.length());
        for (char c : value.toCharArray()) {
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }
}
