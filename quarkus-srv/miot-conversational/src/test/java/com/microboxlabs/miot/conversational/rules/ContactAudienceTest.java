package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.rules.RuleSpec.Audience;
import com.microboxlabs.miot.core.event.ContactDirectory;
import com.microboxlabs.miot.core.event.Participant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ContactAudienceTest {

    private static final String TENANT = "t1";

    private static final ContactDirectory BOOK = tenant -> List.of(
            new ContactDirectory.Entry("c1", "Supervisora", "Supervisor de transporte", List.of("torre"), "Mi Cuenta",
                    null, null, true, "supervisora@example.com", "+56900000001"),
            new ContactDirectory.Entry("c2", "Despacho Sur", "Despachador", List.of("transportista"),
                    "Transportes Sur", "761112223", null, false, "despacho@example.com", null),
            new ContactDirectory.Entry("c3", "Despacho Norte", "Despachador", List.of("transportista"),
                    "Transportes Norte", "769998887", null, false, null, "+56900000003"));

    private static final Map<String, Object> DATA = Map.of("carrierRut", "761112223", "serviceCode", "S-1");
    private static final Map<String, Object> EVENT = Map.of("type", "trip.alert", "data", DATA);

    private static Audiences.Resolved resolve(String when, String channel) {
        return new Audiences(List.of(), List.of(BOOK)).resolve(TENANT, "trip", "trip-1",
                List.of(new Audience(null, null, null, null, null, when)), DATA, channel, EVENT);
    }

    @Test
    void theSupervisorAndTheServicesCarrierAreFoundByACondition() {
        Audiences.Resolved r = resolve("contact.role == 'Supervisor de transporte' || ('transportista' in contact.tags"
                + " && contact.companyRut == event.data.carrierRut)", RuleSpec.EMAIL);
        assertEquals(List.of("supervisora@example.com", "despacho@example.com"),
                r.participants().stream().map(Participant::address).toList());
        assertEquals("c2", r.participants().get(1).contactId());
        assertTrue(r.warnings().isEmpty(), r.warnings().toString());
    }

    @Test
    void theStepsChannelPicksTheAddressAndAContactWithoutOneIsAWarning() {
        Audiences.Resolved r = resolve("'transportista' in contact.tags", RuleSpec.WHATSAPP);
        assertEquals(List.of("+56900000003"), r.participants().stream().map(Participant::address).toList());
        assertEquals(List.of("Despacho Sur no tiene WhatsApp"), r.warnings());

        Audiences.Resolved preferred = resolve("'transportista' in contact.tags", RuleSpec.PREFERRED);
        assertEquals(List.of("email:despacho@example.com", "whatsapp:+56900000003"),
                preferred.participants().stream().map(p -> p.channel() + ":" + p.address()).toList());
    }

    @Test
    void membershipIsAvailableToTheContactCondition() {
        assertEquals(List.of("supervisora@example.com"), resolve("contact.member", RuleSpec.EMAIL).participants()
                .stream().map(Participant::address).toList());
        assertTrue(EventCondition.checkContact("contact.member == true").isEmpty());
    }

    @Test
    void aConditionNobodyMeetsOrThatFailsGivesNoRecipients() {
        assertEquals(List.of("Ningún contacto de la libreta cumple la condición"),
                resolve("contact.companyRut == '1-9'", RuleSpec.EMAIL).warnings());
        assertTrue(resolve("contact.nope.deeper == 1", RuleSpec.EMAIL).participants().isEmpty());
    }

    @Test
    void theValidatorChecksTheCondition() {
        assertTrue(EventCondition.checkContact("'x' in contact.tags && event.data.carrierRut != ''").isEmpty());
        assertTrue(EventCondition.checkContact("contact.role ==").isPresent());
        assertTrue(EventCondition.checkContact("unknown.var == 1").isPresent());
        assertTrue(EventCondition.checkContact("contact.company == \"O'Connor && Sons\\\\West\"").isEmpty());
    }

    @Test
    void anUnavailableBookDoesNotFinishARecipientStepAsIfNobodyMatched() {
        ContactDirectory unavailable = tenant -> {
            throw new IllegalStateException("Database unavailable");
        };
        Audiences audiences = new Audiences(List.of(), List.of(unavailable));
        List<Audience> entries = List.of(new Audience(null, null, null, null, null, "true"));
        assertThrows(IllegalStateException.class, () -> audiences.resolve(TENANT, "trip", "trip-1",
                entries, DATA, RuleSpec.EMAIL, EVENT));
    }
}
