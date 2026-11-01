package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.conversational.rules.TemplatesService.TemplateRequest;
import com.microboxlabs.miot.conversational.rules.TemplatesService.TemplateView;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Message templates are the platform's, versioned on each save. */
class PlatformTemplatesTest {

    private static final Instant T0 = Instant.parse("2026-10-23T12:00:00Z");
    private static final ConvTemplate.WhatsApp CHECK =
            new ConvTemplate.WhatsApp("miot_panic_check_v1", "es_CL", List.of("nombre", "patente"));

    private static ConvTemplate template(String baseText, ConvTemplate.WhatsApp whatsapp, ConvTemplate.Email email) {
        return new ConvTemplate("t", ConvTemplate.PLATFORM_TENANT, "panic", "Pánico", baseText, whatsapp, email, T0,
                T0, "a@example.com", "0.1.0");
    }

    @Test
    void bumps() {
        ConvTemplate base = template("Hola {{nombre}}", CHECK, null);
        assertNull(TemplateBump.between(base, template("Hola {{nombre}}", CHECK, null)));
        assertEquals(RuleBump.PATCH, TemplateBump.between(base, template("Hola, {{nombre}}", CHECK, null)));
        assertEquals(RuleBump.MINOR, TemplateBump.between(base, template("Hola {{nombre}}", CHECK,
                new ConvTemplate.Email("Pánico {{patente}}", "{{nombre}} no responde"))),
                "a channel added, reading the variables there were");
        assertEquals(RuleBump.MAJOR, TemplateBump.between(base, template("Hola {{nombre}}", null, null)),
                "the WhatsApp channel lost");
        assertEquals(RuleBump.MAJOR, TemplateBump.between(base, template("Hola {{nombre}} en {{hora}}", CHECK, null)),
                "a new variable");
        assertEquals(RuleBump.MAJOR, TemplateBump.between(base, template("Hola {{nombre}}",
                new ConvTemplate.WhatsApp("miot_panic_check_v2", "es_CL", List.of("nombre", "patente")), null)),
                "another Meta template");
    }

    @Test
    void savesGoToThePlatformAndRaiseTheVersion() {
        RulesFixture f = new RulesFixture();
        TemplateView first = f.templates.save("welcome", new TemplateRequest("Bienvenida", "Hola {{nombre}}", null,
                null), "owner@example.com");
        assertEquals("0.1.0", first.version());
        assertEquals("0.1.0", f.templates.save("welcome", new TemplateRequest("Bienvenida", "Hola {{nombre}}", null,
                null), "owner@example.com").version(), "the same template keeps its version");
        assertEquals("0.1.1", f.templates.save("welcome", new TemplateRequest("Bienvenida", "Hola, {{nombre}}", null,
                null), "owner@example.com").version());
        assertEquals("1.0.0", f.templates.save("welcome", new TemplateRequest("Bienvenida", "Hola {{patente}}", null,
                null), "owner@example.com").version());

        assertEquals(ConvTemplate.PLATFORM_TENANT,
                f.store.templateStore.find(ConvTemplate.PLATFORM_TENANT, "welcome").orElseThrow().tenantCode());
        assertEquals(List.of("panic-check", "panic-tower", "welcome"),
                f.templates.list(RulesFixture.TENANT).stream().map(TemplateView::key).toList(),
                "an organization reads the platform's templates");
        TemplateRequest any = new TemplateRequest("x", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> f.templates.save("Bad Key", any, "owner@example.com"));
    }

    @Test
    void anHtmlEmailIsCheckedWhenSavedAndPreviewedWithItsValuesEscaped() {
        RulesFixture f = new RulesFixture();
        ConvTemplate.Email html = new ConvTemplate.Email("Cupo de {{company}}", null, "<p>{{company}}: {{used}}</p>");
        assertEquals("0.1.0", f.templates.save("quota", new TemplateRequest("Cupo", null, null, html),
                "owner@example.com").version());
        assertThrows(IllegalArgumentException.class, () -> f.templates.save("quota-bad", new TemplateRequest("Cupo",
                null, null, new ConvTemplate.Email("s", null, "<p>{{{company}}}</p>")), "owner@example.com"),
                "a value written without escaping");

        TemplatesService.EmailPreview preview = f.templates.previewEmail(new TemplatesService.EmailPreviewRequest(
                "Cupo de {{company}}", "<p>{{company}}: {{used}}</p>", Map.of("company", "A & <B>", "used", "8")));
        assertEquals("Cupo de A & <B>", preview.subject());
        assertEquals("<p>A &amp; &lt;B&gt;: 8</p>", preview.html());
        assertEquals("A & <B>: 8", preview.text().strip());
    }

    @Test
    void thePlatformSeesWhoseRulesUseATemplate() {
        RulesFixture f = new RulesFixture();
        f.rule("panic", RulesFixture.PANIC_SPEC, Rule.State.TEST);
        TemplateView check = f.templates.platformGet("panic-check");
        assertEquals(1, check.usedBy().size());
        assertEquals(RulesFixture.TENANT, check.usedBy().get(0).tenantCode());
        assertNull(f.templates.get(RulesFixture.TENANT, "panic-check").usedBy().get(0).tenantCode());
    }
}
