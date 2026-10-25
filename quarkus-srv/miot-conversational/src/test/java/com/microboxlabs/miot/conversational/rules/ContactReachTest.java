package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.conversational.rules.ContactReach.Reached;
import com.microboxlabs.miot.core.event.ContactDirectory;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ContactReachTest {

    private static final String TENANT = "t1";
    private static final Instant T0 = Instant.parse("2026-10-01T12:00:00Z");
    private static final ObjectMapper JSON = new ObjectMapper();

    private static final ContactDirectory BOOK = tenant -> List.of(
            new ContactDirectory.Entry("c1", "Supervisora", "Supervisor de transporte", List.of("torre"), "Mi Cuenta",
                    null, null, true, "supervisora@example.com", null),
            new ContactDirectory.Entry("c2", "Despacho Sur", "Despachador", List.of("transportista"),
                    "Transportes Sur", "761112223", null, false, "despacho@example.com", null),
            new ContactDirectory.Entry("c3", "Sin relación", "Otro", List.of(), null, null, null, false, null, null));

    private final InMemoryRules store = new InMemoryRules();

    private void rule(String id, String name, Rule.State state, String spec) throws Exception {
        store.rules.put(id, new Rule(id, TENANT, id, name, state, "0.1.0", T0, T0));
        store.versions.add(new RuleVersion("v-" + id, id, "0.1.0", RuleBump.MINOR, RuleVersion.Status.PUBLISHED,
                JSON.readTree(spec), null, T0, "a@example.com"));
    }

    @Test
    void aContactIsReachedAlwaysOrDependingOnTheEvent() throws Exception {
        rule("alerts", "Alertas", Rule.State.ACTIVE, """
                {"steps":[{"channel":"email","template":"t","to":[{"contacts":
                "contact.role == 'Supervisor de transporte' || ('transportista' in contact.tags && contact.companyRut == event.data.carrierRut)"}]}]}""");
        rule("off", "Apagada", Rule.State.OFF, """
                {"steps":[{"channel":"email","template":"t","to":[{"contacts":"contact.role != ''"}]}]}""");
        rule("fixed", "Fija", Rule.State.TEST, """
                {"steps":[{"channel":"email","template":"t","to":[{"address":"x@example.com"}]}]}""");

        Map<String, List<Reached>> reach = new ContactReach(store.ruleStore, () -> List.of(BOOK)).byContact(TENANT);

        assertEquals(List.of(new Reached("alerts", "Alertas", Rule.State.ACTIVE, true)), reach.get("c1"));
        assertEquals(List.of(new Reached("alerts", "Alertas", Rule.State.ACTIVE, false)), reach.get("c2"));
        assertEquals(null, reach.get("c3"));
    }

    @Test
    void aConditionWithoutTheEventDecidesWhenItCan() {
        Map<String, Object> carrier = Audiences.contactVars(new ContactDirectory.Entry("c2", "Despacho", "Despachador",
                List.of("transportista"), null, "761112223", null, false, null, null));
        assertEquals(EventCondition.Reach.NO,
                EventCondition.reachContact("contact.role == 'Jefe' && contact.companyRut == event.data.x", carrier));
        assertEquals(EventCondition.Reach.YES,
                EventCondition.reachContact("contact.role == 'Despachador' || event.data.x == 1", carrier));
        assertEquals(EventCondition.Reach.DEPENDS,
                EventCondition.reachContact("contact.companyRut == event.data.carrierRut", carrier));
        assertEquals(EventCondition.Reach.NO, EventCondition.reachContact("not valid ((", carrier));
    }
}
