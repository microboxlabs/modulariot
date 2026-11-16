package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.RulesFixture.T0;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.TENANT;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.rules.RuleSpecValidator.Finding;
import com.microboxlabs.miot.conversational.rules.TemplatesService.TemplateRequest;
import com.microboxlabs.miot.conversational.rules.TemplatesService.TemplateView;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** An organization's own templates, and the parameters a rule step writes into a template. */
class OrgTemplatesTest {

    private static final String OTHER = "tenant-2";
    private static final List<ConvTemplate.Param> PARAMS = List.of(new ConvTemplate.Param("titulo", "Título", false),
            new ConvTemplate.Param("mensaje", "Mensaje", true));
    private static final ConvTemplate.Teams CARD = new ConvTemplate.Teams("{{titulo}}", null, null, "{{mensaje}}",
            null, List.of(new ConvTemplate.Teams.Fact("Nivel", "{{level}}")), List.of(), List.of());

    private final RulesFixture f = new RulesFixture();

    private TemplateView alert() {
        return f.templates.saveOwn(TENANT, "alerta", new TemplateRequest("Alerta", "{{titulo}}: {{mensaje}}", null,
                null, CARD, PARAMS), "admin@example.com");
    }

    private static String spec(String values) {
        return """
                {"trigger": {"event": "symptom.case.opened"}, "groups": [],
                 "steps": [{"channel": "teams", "connection": "TEAMS", "template": "alerta", "values": %s}]}
                """.formatted(values);
    }

    @Test
    void anOrganizationsTemplateIsItsOwn() {
        TemplateView saved = alert();
        assertEquals(ConvTemplate.OWNER_ORGANIZATION, saved.owner());
        assertEquals(PARAMS, saved.params());
        assertEquals(TENANT, f.store.templateStore.find(TENANT, "alerta").orElseThrow().tenantCode());

        assertTrue(f.templates.list(TENANT).stream().anyMatch(t -> t.key().equals("alerta")));
        assertEquals(ConvTemplate.OWNER_PLATFORM, f.templates.get(TENANT, "panic-check").owner());
        assertFalse(f.templates.list(OTHER).stream().anyMatch(t -> t.key().equals("alerta")),
                "another organization does not see it");
        assertThrows(java.util.NoSuchElementException.class, () -> f.templates.get(OTHER, "alerta"));
        assertFalse(f.templates.platformList().stream().anyMatch(t -> t.key().equals("alerta")));
    }

    @Test
    void anOrganizationsTemplateHasNoWhatsAppAndNoPlatformKey() {
        TemplateRequest whatsapp = new TemplateRequest("x", "Hola", new ConvTemplate.WhatsApp("m", "es", List.of()),
                null);
        assertThrows(IllegalArgumentException.class, () -> f.templates.saveOwn(TENANT, "propia", whatsapp, "a"));
        TemplateRequest plain = new TemplateRequest("x", "Hola", null, null);
        assertThrows(IllegalArgumentException.class, () -> f.templates.saveOwn(TENANT, "panic-tower", plain, "a"),
                "the key is the platform's");
        TemplateRequest badName = new TemplateRequest("x", "Hola", null, null, null,
                List.of(new ConvTemplate.Param("con espacio", null, false)));
        assertThrows(IllegalArgumentException.class, () -> f.templates.saveOwn(TENANT, "propia", badName, "a"));
        TemplateRequest repeated = new TemplateRequest("x", "Hola", null, null, null,
                List.of(new ConvTemplate.Param("a", null, false), new ConvTemplate.Param("a", null, false)));
        assertThrows(IllegalArgumentException.class, () -> f.templates.saveOwn(TENANT, "propia", repeated, "a"));
        TemplateRequest paramsAndWhatsapp = new TemplateRequest("x", "Hola", new ConvTemplate.WhatsApp("m", "es",
                List.of()), null, null, PARAMS);
        assertThrows(IllegalArgumentException.class, () -> f.templates.save("propia", paramsAndWhatsapp, "a"),
                "a WhatsApp variant cannot take the step's values");
    }

    @Test
    void parametersAreVersioned() {
        assertEquals("0.1.0", alert().version());
        TemplateRequest relabeled = new TemplateRequest("Alerta", "{{titulo}}: {{mensaje}}", null, null, CARD,
                List.of(new ConvTemplate.Param("titulo", "Encabezado", false), PARAMS.get(1)));
        assertEquals("0.1.1", f.templates.saveOwn(TENANT, "alerta", relabeled, "a").version(), "a label");
        TemplateRequest fewer = new TemplateRequest("Alerta", "{{titulo}}: {{mensaje}}", null, null, CARD,
                List.of(PARAMS.get(0)));
        assertEquals("1.0.0", f.templates.saveOwn(TENANT, "alerta", fewer, "a").version(), "a parameter less");
    }

    @Test
    void bindWritesTheValuesIntoEveryTextAndEscapesThemInHtml() {
        ConvTemplate t = new ConvTemplate("t", TENANT, "k", "K", "{{titulo}} {{level}}", null,
                new ConvTemplate.Email("{{titulo}}", null, "<p>{{titulo}}</p>"), CARD, T0, T0, "a", "0.1.0", PARAMS);
        ConvTemplate bound = t.bind(Map.of("titulo", "A & <B> {{assetId}}"));
        assertEquals("A & <B> {{assetId}} {{level}}", bound.baseText(), "event variables stay for the render");
        assertEquals("A & <B> {{assetId}}", bound.email().subject());
        assertEquals("<p>A &amp; &lt;B&gt; {{assetId}}</p>", bound.email().html());
        assertEquals("A & <B> {{assetId}}", bound.teams().title());
        assertEquals("", bound.teams().text(), "a parameter without a value is empty");
        assertEquals("{{level}}", bound.teams().facts().get(0).value());
    }

    @Test
    void theSimulationWritesTheStepsValuesWithTheEventsVariables() {
        alert();
        String teams = f.integrations.channels.create(ConnectionChannel.TEAMS, TENANT, "Equipo torre",
                "https://hooks.example.com/teams", null).id();
        Rule rule = f.rule("alerta", spec("""
                {"titulo": "Pánico en {{assetId}}", "mensaje": "Revisar"}""").replace("TEAMS", teams),
                Rule.State.OFF);

        RuleSimulator.Simulation sim = f.simulator.simulate(TENANT, rule.id(),
                new RuleSimulator.SampleEvent("symptom.case.opened", new RuleSimulator.SampleContext("symptom_case",
                        "-7"), Map.of("assetId", "ABCD12", "level", 4), false, T0));

        assertTrue(sim.findings().stream().noneMatch(x -> x.severity() == RuleSpecValidator.Severity.ERROR),
                sim.findings().toString());
        assertEquals(1, sim.messages().size());
        String body = sim.messages().get(0).body().toString();
        assertTrue(body.contains("Pánico en ABCD12"), body);
        assertTrue(body.contains("Revisar"), body);
    }

    @Test
    void aStepMissingAValueIsAnErrorAndAnUnknownValueAWarning() {
        alert();
        List<Finding> findings = f.service.validate(TENANT, RuleSpec.read(RulesFixture.json(spec("""
                {"titulo": "Hola", "otro": "x"}"""))));
        assertTrue(findings.stream().anyMatch(x -> x.code().equals("stepMissingValue")
                && x.params().get("name").equals("mensaje") && x.severity() == RuleSpecValidator.Severity.ERROR),
                findings.toString());
        assertTrue(findings.stream().anyMatch(x -> x.code().equals("stepUnknownValue")
                && x.severity() == RuleSpecValidator.Severity.WARNING), findings.toString());
    }

    @Test
    void aTemplateInUseIsNotDeleted() {
        alert();
        Rule rule = f.rule("alerta", spec("{\"titulo\": \"a\", \"mensaje\": \"b\"}"), Rule.State.OFF);
        assertThrows(IllegalStateException.class, () -> f.templates.delete(TENANT, "alerta"));
        assertTrue(f.templates.get(TENANT, "alerta").usedBy().stream().anyMatch(r -> r.id().equals(rule.id())));
        assertThrows(java.util.NoSuchElementException.class, () -> f.templates.delete(TENANT, "panic-tower"),
                "an organization cannot delete the platform's");

        f.templates.saveOwn(TENANT, "suelta", new TemplateRequest("Suelta", "Hola", null, null), "a");
        f.templates.delete(TENANT, "suelta");
        assertTrue(f.store.templateStore.find(TENANT, "suelta").isEmpty());
    }
}
