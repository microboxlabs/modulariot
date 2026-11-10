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

    @Test
    void formattedContactsMatchTheNormalizedTripData() {
        List<String> who = List.of("contact.role == 'Conductor' && contact.nationalId == event.data.driverRut",
                "contact.role == 'Gerente' && contact.companyRut == event.data.carrierRut");
        Map<String, Object> trip = Map.of("driverRut", "000000019", "carrierRut", "000000030");
        List<List<String>> formats = List.of(
                List.of("000000019", "000000030"),
                List.of("00000001-9", "00000003-0"),
                List.of("00.000.001-9", "00.000.003-0"),
                List.of(" 00 000 001 - 9 ", " 00 000 003 - 0 "));
        for (List<String> format : formats) {
            Entry driver = person("driver-demo", "Conductor", null, format.get(0));
            Entry manager = person("manager-demo", "Gerente", format.get(1), null);
            BookContactConditions book = new BookContactConditions(tenant -> List.of(driver, manager));
            assertEquals(List.of(List.of("driver-demo"), List.of("manager-demo")), book.match("t", who, trip));
            assertEquals(format.get(0), driver.nationalId());
            assertEquals(format.get(1), manager.companyRut());
        }
    }

    @Test
    void aLowercaseVerifierInTheBookMatchesTheTrip() {
        BookContactConditions book = new BookContactConditions(tenant -> List.of(
                person("driver-demo", "Conductor", null, "00000002-k")));
        assertEquals(List.of(List.of("driver-demo")), book.match("t",
                List.of("contact.nationalId == event.data.driverRut"), Map.of("driverRut", "00000002K")));
    }

    @Test
    void findsTheCoordinatorOfTheTripsOriginByTag() {
        BookContactConditions cats = new BookContactConditions(tenant -> List.of(
                new Entry("norte", "Norte", "CAT", List.of("Planta Norte", "Bodega Este"), null, null, null, false,
                        null, "+12025550101"),
                new Entry("sur", "Sur", "cat", List.of("  planta  NORTE "), null, null, null, false, null,
                        "+12025550102"),
                new Entry("acento", "Acento", "CAT", List.of("Peñón"), null, null, null, false, null,
                        "+12025550103"),
                new Entry("otro", "Otro", "Supervisor", List.of("Planta Norte"), null, null, null, false, null,
                        "+12025550104")));
        Map<String, Object> trip = Map.of("origin", "Planta Norte", "originKey", "planta norte");

        assertEquals(List.of(List.of("norte"), List.of("norte", "sur"), List.of("acento"), List.of()),
                cats.match("t", List.of(
                        "contact.role == 'CAT' && event.data.origin in contact.tags",
                        "contact.roleKey == 'cat' && event.data.originKey in contact.tagKeys",
                        "contact.roleKey == 'cat' && 'penon' in contact.tagKeys",
                        "contact.roleKey == 'cat' && has(event.data.destinationKey)"
                                + " && event.data.destinationKey in contact.tagKeys"), trip));
    }
}
