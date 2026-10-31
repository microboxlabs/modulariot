package com.microboxlabs.miot.integrations.geocoding;

import com.microboxlabs.miot.core.mail.Mail;
import java.util.Map;

public final class GeocodingQuotaMail {

    private GeocodingQuotaMail() {
    }

    public static String nextStep(GeocodingQuotaNotification n) {
        if (!n.enforced() && "review".equals(n.onExhausted())) {
            return "El límite no está activo; las llamadas continúan. Al activar el límite: " + policy(n);
        }
        String prefix = GeocodingQuotaNotification.THRESHOLD.equals(n.level()) ? "Al agotarse la cuota: " : "";
        return prefix + policy(n);
    }

    private static String policy(GeocodingQuotaNotification n) {
        if ("overage".equals(n.onExhausted())) {
            return "Las llamadas continúan y cada llamada adicional se cobra a "
                    + n.overagePriceUsd().toPlainString() + " USD.";
        }
        return "Las nuevas direcciones pasan a revisión hasta el próximo mes o hasta que se aumente la cuota.";
    }

    public static Mail mail(GeocodingQuotaNotification n, String to, String publicUrl) {
        String title = GeocodingQuotaNotification.EXHAUSTED.equals(n.level())
                ? "Cuota de geocodificación agotada" : "Aviso de cuota de geocodificación";
        String summary = n.organizationName() + " (" + n.organization() + "), mes " + n.month() + " (UTC): "
                + n.used() + " / " + n.quota() + " llamadas (" + n.usedPct() + "%).";
        String url = publicUrl == null ? n.usagePath() : stripSlash(publicUrl) + n.usagePath().substring("/app".length());
        String text = title + "\n\n" + summary + "\n" + nextStep(n) + "\n\nPanel de consumo: " + url;
        String html = "<h1>" + escape(title) + "</h1><p>" + escape(summary) + "</p><p>" + escape(nextStep(n))
                + "</p><p><a href=\"" + escape(url) + "\">Panel de consumo</a>: " + escape(n.usagePath()) + "</p>";
        return new Mail(to, title + " — " + n.organizationName(), text, html);
    }

    public static Map<String, String> templateParams(GeocodingQuotaNotification n) {
        return Map.of("organization", n.organizationName() + " (" + n.month() + ")",
                "used", Long.toString(n.used()), "quota", Integer.toString(n.quota()),
                "pct", Integer.toString(n.usedPct()), "next_step", nextStep(n));
    }

    public static String text(GeocodingQuotaNotification n) {
        return n.organizationName() + ", mes " + n.month() + " (UTC): " + n.used() + " / " + n.quota()
                + " llamadas de geocodificación (" + n.usedPct() + "%). " + nextStep(n)
                + " Panel de consumo: " + n.usagePath();
    }

    private static String stripSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
