package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.Trip;
import java.time.OffsetDateTime;
import java.util.List;

/** A trip as the API serves it; the detail adds mandates, stages, assignments and cargo. */
public record TripView(
        String id,
        String status,
        String originId,
        String destinationId,
        OffsetDateTime plannedStart,
        OffsetDateTime actualStart,
        OffsetDateTime actualEnd,
        String cancelReason,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        List<MandateRef> mandates,
        List<StageView> stages,
        List<AssignmentView> assignments,
        List<TripCargoView> cargo) {

    public static TripView of(Trip t) {
        return of(t, null, null, null, null);
    }

    public static TripView of(Trip t, List<MandateRef> mandates, List<StageView> stages,
            List<AssignmentView> assignments, List<TripCargoView> cargo) {
        return new TripView(t.id(), t.status(), t.originId(), t.destinationId(),
                t.plannedStart(), t.actualStart(), t.actualEnd(), t.cancelReason(),
                t.createdAt(), t.createdBy(), t.updatedAt(), mandates, stages, assignments, cargo);
    }
}
