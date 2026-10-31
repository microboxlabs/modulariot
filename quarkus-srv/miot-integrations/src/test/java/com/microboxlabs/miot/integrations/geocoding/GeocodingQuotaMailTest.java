package com.microboxlabs.miot.integrations.geocoding;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class GeocodingQuotaMailTest {

    static GeocodingQuotaNotification notification(String mode, String level, boolean enforced) {
        return new GeocodingQuotaNotification("example-org", "Example <Org>", 1, "tenant-1", "2026-10", level,
                100, 100, 100, mode, enforced, new BigDecimal("0.005"), "/app/es/users/settings/geocoding",
                List.of(), List.of(), List.of(), List.of());
    }

    @Test
    void exhaustedReviewExplainsTheMonthOrQuotaIncreaseAndEscapesHtml() {
        var mail = GeocodingQuotaMail.mail(notification("review", "exhausted", true), "admin@example.com", "https://app.example.com/app/");
        assertTrue(mail.subject().contains("agotada"));
        assertTrue(mail.text().contains("2026-10 (UTC): 100 / 100 llamadas (100%)"));
        assertTrue(mail.text().contains("hasta el próximo mes o hasta que se aumente la cuota"));
        assertTrue(mail.html().contains("Example &lt;Org&gt;"));
        assertTrue(mail.html().contains("https://app.example.com/app/es/users/settings/geocoding"));
    }

    @Test
    void exhaustedOverageStatesCallsContinueAndTheirPrice() {
        var mail = GeocodingQuotaMail.mail(notification("overage", "exhausted", true), "owner@example.com", null);
        assertTrue(mail.text().contains("Las llamadas continúan"));
        assertTrue(mail.text().contains("0.005 USD"));
        assertTrue(mail.text().contains("/app/es/users/settings/geocoding"));
        assertFalse(mail.text().contains("pasan a revisión"));
    }

    @Test
    void thresholdAndUnenforcedPlansExplainWhenThePolicyApplies() {
        assertTrue(GeocodingQuotaMail.nextStep(notification("review", "threshold", true)).startsWith("Al agotarse la cuota:"));
        assertTrue(GeocodingQuotaMail.nextStep(notification("review", "exhausted", false)).contains("El límite no está activo"));
    }

    @Test
    void templateAndFreeTextContainTheSnapshotContext() {
        var n = notification("review", "exhausted", true);
        var params = GeocodingQuotaMail.templateParams(n);
        assertEquals(5, params.size());
        assertEquals("Example <Org> (2026-10)", params.get("organization"));
        assertEquals("100", params.get("used"));
        assertEquals("100", params.get("quota"));
        assertEquals("100", params.get("pct"));
        assertTrue(GeocodingQuotaMail.text(n).contains("2026-10 (UTC)"));
        assertEquals("geocoding-quota:example-org:2026-10:exhausted", n.idempotencyKey());
    }
}
