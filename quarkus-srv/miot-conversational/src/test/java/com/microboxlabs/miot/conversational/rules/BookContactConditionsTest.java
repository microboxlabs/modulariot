package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.event.ContactDirectory.Entry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Operator steps name their people with the same contact conditions as a book audience. */
class BookContactConditionsTest {

    private static final String SUR = "761112228";

    private static Entry person(String id, String role, String companyRut, String nationalId) {
        return new Entry(id, id, role, List.of(), companyRut == null ? null : "Transportes Sur", companyRut, null,
                false, null, "+56900000101", nationalId);
    }

    private final BookContactConditions conditions = new BookContactConditions(tenant -> List.of(
            person("ana", "Conductor", SUR, "123456785"),
            person("beto", "Conductor", "769999999", "98765432K"),
            person("gerente", "Gerente de Seguridad", SUR, null),
            person("torre", "Jefe de Torre de Control", null, null)));

    private static final Map<String, Object> TRIP = Map.of("driverRut", "123456785", "carrierRut", SUR);

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
    void aTripWithoutTheFieldOrABlankOrBrokenConditionFindsNobody() {
        List<List<String>> found = conditions.match("t", List.of(
                "contact.nationalId == event.data.secondDriverRut", "", "contact.role == ("), TRIP);

        assertEquals(List.of(List.of(), List.of(), List.of()), found);
        assertTrue(conditions.problem("contact.role == (").isPresent());
        assertTrue(conditions.problem("contact.role == 'Conductor'").isEmpty());
    }
}
