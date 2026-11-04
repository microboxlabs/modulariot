package com.microboxlabs.miot.symptoms.dto;

import java.util.List;

/**
 * The contact book's people for a case's trip, found by RUT only.
 *
 * @param driverRuts the trip's driver RUTs, normalized; empty when the trip has none
 * @param carrierRut the trip carrier's tax id, normalized, or null
 * @param drivers    ids of active contacts with role Conductor whose national id is one of {@code driverRuts}
 * @param carrierContacts ids of active contacts of any role whose company tax id is {@code carrierRut}
 */
public record TripContactsView(List<String> driverRuts, String carrierRut, List<String> drivers,
        List<String> carrierContacts) {
}
