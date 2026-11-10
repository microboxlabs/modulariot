package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.core.tax.NationalIds;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * The RUTs of a case's trip: its driver and second driver, and its carrier company; and the trip's origin and
 * destination. Empty when the case has no live trip or the trip does not say.
 *
 * <p>RUTs are normalized with {@link NationalIds#normalize}: the trip stores {@code 11111111-1}, the book
 * {@code 111111111}.
 *
 * @param driverRuts the driver's RUT, then the second driver's
 * @param carrierRut the carrier company's tax id, or null
 * @param route the trip's origin and destination; never null
 */
public record TripPeople(List<String> driverRuts, String carrierRut, String driverRut, String secondDriverRut,
        TripRoute route) {

    public TripPeople {
        route = route == null ? TripRoute.NONE : route;
    }

    public TripPeople(List<String> driverRuts, String carrierRut, String driverRut, String secondDriverRut) {
        this(driverRuts, carrierRut, driverRut, secondDriverRut, TripRoute.NONE);
    }

    public TripPeople(List<String> driverRuts, String carrierRut) {
        this(driverRuts, carrierRut, driverRuts.isEmpty() ? null : driverRuts.get(0),
                driverRuts.size() > 1 ? driverRuts.get(1) : null);
    }

    /** The same people on {@code route}. */
    public TripPeople withRoute(TripRoute route) {
        return new TripPeople(driverRuts, carrierRut, driverRut, secondDriverRut, route);
    }

    public static final TripPeople NONE = new TripPeople(List.of(), null);

    /** Normalizes the RUTs and leaves out blank and repeated ones. */
    public static TripPeople of(String driverRut, String secondDriverRut, String carrierRut) {
        String driver = NationalIds.normalize(driverRut);
        String second = NationalIds.normalize(secondDriverRut);
        List<String> drivers = Stream.of(driver, second).filter(Objects::nonNull).distinct().toList();
        return new TripPeople(drivers, NationalIds.normalize(carrierRut), driver, second);
    }
}
