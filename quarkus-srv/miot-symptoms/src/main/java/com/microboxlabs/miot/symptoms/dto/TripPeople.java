package com.microboxlabs.miot.symptoms.dto;

import java.util.List;

/**
 * The RUTs of a case's trip: its driver and second driver, and its carrier company. Empty when the case has no live
 * trip or the trip does not say.
 *
 * @param driverRuts the driver's RUT, then the second driver's, as the trip stores them
 * @param carrierRut the carrier company's tax id, or null
 */
public record TripPeople(List<String> driverRuts, String carrierRut) {

    public static final TripPeople NONE = new TripPeople(List.of(), null);

    /** Leaves out blank and repeated RUTs. */
    public static TripPeople of(String driverRut, String secondDriverRut, String carrierRut) {
        List<String> drivers = java.util.stream.Stream.of(driverRut, secondDriverRut)
                .filter(r -> r != null && !r.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
        return new TripPeople(drivers, carrierRut == null || carrierRut.isBlank() ? null : carrierRut.trim());
    }
}
