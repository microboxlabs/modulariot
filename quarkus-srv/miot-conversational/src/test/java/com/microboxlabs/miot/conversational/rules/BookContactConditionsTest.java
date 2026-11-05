package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.event.ContactDirectory.Entry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Operator steps name their people with the same contact conditions as a book audience. */
class BookContactConditionsTest {

    private static final String SUR = "000000030";

    private static Entry person(String id, String role, String companyRut, String nationalId) {
        return new Entry(id, id, role, List.of(), companyRut == null ? null : "Transportes Sur", companyRut, null,
                false, null, "+12025550101", nationalId);
    }

    private final BookContactConditions conditions = new BookContactConditions(tenant -> List.of(
            person("ana", "Conductor", SUR, "000000019"),
            person("beto", "Conductor", "000000050", "00000002K"),
            person("gerente", "Gerente de Seguridad", SUR, null),
            person("torre", "Jefe de Torre de Control", null, null)));

    private static final Map<String, Object> TRIP = Map.of("driverRut", "000000019", "carrierRut", SUR);

    @Test
    void findsTheTripsDriverTheCarriersRoleAndTheOrganizationsOwnPeople() {
        List<List<String>> found = conditions.match("t", List.of(
                "contact.role == 'Conductor' && contact.nationalId == event.data.driverRut",
                "contact.role == 'Gerente de Seguridad' && contact.companyRut == event.data.carrierRut",
                "contact.companyRut == event.data.carrierRut",
                "contact.role == 'Jefe de Torre de Control' && contact.companyRut == ''"), TRIP);

        assertEquals(List.of(List.of("ana"), List.of("gerente"), List.of("ana", "gerente"), List.of("torre")), found);
    }

    @Test
    void legacyDriverConditionsKeepBothDriversAndHandleMissingTripFields() {
        String who = "contact.roleKey == 'conductor' && ((has(event.data.driverRut) && contact.nationalId == "
                + "event.data.driverRut) || (has(event.data.secondDriverRut) && contact.nationalId == "
                + "event.data.secondDriverRut))";
        BookContactConditions legacy = new BookContactConditions(tenant -> List.of(
                person("ana", " conductor ", SUR, "000000019"),
                person("beto", "CONDUCTOR", null, "00000002K")));
        assertEquals(List.of(List.of("ana", "beto")), legacy.match("t", List.of(who),
                Map.of("driverRut", "000000019", "secondDriverRut", "00000002K")));
        assertEquals(List.of(List.of("beto")), legacy.match("t", List.of(who),
                Map.of("secondDriverRut", "00000002K")));
        assertEquals(List.of(List.of()), conditions.match("t", List.of(who), Map.of()));
    }

    @Test
    void aTripWithoutTheFieldOrABlankOrBrokenConditionFindsNobody() {
        List<List<String>> found = conditions.match("t", List.of(
                "contact.nationalId == event.data.secondDriverRut", "", "contact.role == ("), TRIP);

        assertEquals(List.of(List.of(), List.of(), List.of()), found);
        assertTrue(conditions.problem("contact.role == (").isPresent());
        assertTrue(conditions.problem("contact.role == 'Conductor'").isEmpty());
    }
    @Test
    void legacyIdentifierTypeGuardsKeepDniAndRucContactsDistinctFromRut() {
        BookContactConditions typed = new BookContactConditions(tenant -> List.of(
                new Entry("dni", "DNI", "Conductor", List.of(), "Peru", "20100000009", null, false, null, null, "12345674", "DNI", "RUC"),
                new Entry("rut", "RUT", "Conductor", List.of(), "Other", "20100000009", null, false, null, null, "12345674", "RUT", "RUT")));
        assertEquals(List.of(List.of("dni"), List.of("dni")), typed.match("t", List.of(
                "contact.nationalId == event.data.driverRut && contact.nationalIdType == event.data.driverIdType",
                "contact.companyRut == event.data.carrierRut && contact.companyTaxIdType == event.data.carrierIdType"),
                Map.of("driverRut", "12345674", "driverIdType", "DNI", "carrierRut", "20100000009", "carrierIdType", "RUC")));
    }

}
