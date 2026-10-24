package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.TripCargoLink;
import java.time.OffsetDateTime;

/** A cargo-on-trip link as the API serves it; {@code cargo} rides along when the caller asked for it. */
public record TripCargoView(
        String tripId,
        String cargoId,
        String loadedAtStage,
        String unloadedAtStage,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        CargoView cargo) {

    public static TripCargoView of(TripCargoLink l) {
        return of(l, null);
    }

    public static TripCargoView of(TripCargoLink l, CargoUnit cargo) {
        return new TripCargoView(l.tripId(), l.cargoId(), l.loadedAtStage(), l.unloadedAtStage(),
                l.createdAt(), l.updatedAt(), cargo == null ? null : CargoView.of(cargo));
    }
}
