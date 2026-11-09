package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.dto.TripPlace;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The contact book's tag suggestions: each trip place once, as most trips write it. */
class PgTripPlacesTest {

    @Test
    void placesThatDifferOnlyInCaseAccentsOrSpacesAreOne() {
        List<TripPlace> merged = PgTripPlaces.merge(List.of(
                new TripPlace("Planta Peñón", 3, 1),
                new TripPlace("planta  penon", 1, 0),
                new TripPlace("Bodega Sur", 0, 7),
                new TripPlace("   ", 2, 2)));

        assertEquals(List.of(new TripPlace("Bodega Sur", 0, 7), new TripPlace("Planta Peñón", 4, 1)), merged);
    }
}
