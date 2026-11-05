package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.TripRef;
import java.time.OffsetDateTime;
import java.util.List;

/** A mandate as the API serves it; {@code detail} adds cargo and linked trips. */
public record MandateView(
        String id,
        String externalCode,
        String orderType,
        String orderRef,
        String status,
        String originId,
        String destinationId,
        Integer slaMinutes,
        OffsetDateTime closedAt,
        String cancelReason,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        List<CargoView> cargo,
        List<TripRef> trips) {

    public static MandateView of(Mandate m) {
        return of(m, null, null);
    }

    public static MandateView of(Mandate m, List<CargoUnit> cargo, List<TripRef> trips) {
        return new MandateView(m.id(), m.externalCode(), m.orderType(), m.orderRef(), m.status(),
                m.originId(), m.destinationId(), m.slaMinutes(), m.closedAt(), m.cancelReason(),
                m.createdAt(), m.createdBy(), m.updatedAt(),
                cargo == null ? null : cargo.stream().map(CargoView::of).toList(), trips);
    }
}
