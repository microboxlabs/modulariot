package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.trips.domain.BoardRow;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TripBoardTest {

    private static final OffsetDateTime NOW = OffsetDateTime.of(2026, 10, 25, 12, 0, 0, 0, ZoneOffset.UTC);
    private static final OffsetDateTime PAST = NOW.minusHours(2);
    private static final OffsetDateTime LATER = NOW.plusHours(2);

    private static BoardRow row(String status, String current, String last, Map<String, String> milestones,
            Set<String> alerts, OffsetDateTime plannedStart, OffsetDateTime arrival, boolean resources) {
        return new BoardRow("t1", status, plannedStart, arrival, null, null, null, current, last, milestones, alerts,
                null, null, null, null, resources ? "AB-123" : null, null, resources ? "Driver" : null, null, null,
                null, false, null, NOW);
    }

    private static String lane(BoardRow row) {
        return TripBoard.lane(row, NOW);
    }

    @Test
    void beforeDepartureATripIsUnassignedScheduledOrToConfirm() {
        assertEquals(TripBoard.UNASSIGNED, lane(row("planned", null, null, null, null, LATER, null, false)));
        assertEquals(TripBoard.SCHEDULED, lane(row("planned", null, null, null, null, LATER, null, true)));
        assertEquals(TripBoard.SCHEDULED, lane(row("in_progress", "preparation", null, null, null, LATER, null,
                true)));
        assertEquals(TripBoard.DEPARTURE_PENDING, lane(row("in_progress", "preparation", null,
                Map.of("departure", "pending"), null, LATER, null, true)), "a detection waits for a person");
        assertEquals(TripBoard.DEPARTURE_PENDING, lane(row("in_progress", "preparation", null, null,
                Set.of("departure_overdue"), PAST, null, false)), "the monitor raised the overdue alert");
    }

    @Test
    void presentationThenValidationThenTheDepartureAuthorization() {
        assertEquals(TripBoard.PRESENTATION, lane(row("in_progress", "preparation", null,
                Map.of("presentation", "pending"), null, LATER, null, true)), "a gate or the GPS saw the truck");
        assertEquals(TripBoard.PRESENTATION, lane(row("in_progress", "preparation", null, null,
                Set.of("presentation_overdue"), PAST, null, true)));
        assertEquals(TripBoard.VALIDATION, lane(row("in_progress", "loading", "preparation",
                Map.of("presentation", "confirmed"), null, LATER, null, true)));
        assertEquals(TripBoard.VALIDATION, lane(row("in_progress", "loading", "preparation",
                Map.of("presentation", "confirmed", "validation", "rejected"), null, LATER, null, true)));
        assertEquals(TripBoard.VALIDATION, lane(row("in_progress", "preparation", null,
                Map.of("validation", "pending"), null, LATER, null, true)), "checks came before the presentation");
        assertEquals(TripBoard.DEPARTURE_PENDING, lane(row("in_progress", "loading", "preparation",
                Map.of("presentation", "confirmed", "validation", "confirmed"), null, LATER, null, true)));
    }

    @Test
    void aConfirmedClosureEndsTheMonitoringAndTheTripWaitsForItsDelivery() {
        assertEquals(TripBoard.TO_DELIVER, lane(row("in_progress", null, "closing",
                Map.of("departure", "confirmed", "arrival", "confirmed", "closure", "confirmed"), null, PAST, PAST,
                true)));
    }

    @Test
    void anOverdueAlertCountsOnlyWhileThePlannedTimeIsPast() {
        assertEquals(TripBoard.SCHEDULED, lane(row("in_progress", "preparation", null, null,
                Set.of("departure_overdue"), LATER, null, true)), "the feed moved the departure later");
        assertEquals(TripBoard.SCHEDULED, lane(row("in_progress", "preparation", null, null, null, PAST, null,
                true)), "a past time alone is not overdue: the monitor's grace decides");
    }

    @Test
    void enRouteAndAtDestinationFollowTheStage() {
        assertEquals(TripBoard.IN_TRANSIT, lane(row("in_progress", "transit", "preparation", null, null, PAST,
                LATER, true)));
        assertEquals(TripBoard.IN_TRANSIT, lane(row("in_progress", "stop", "transit", null, null, PAST, LATER,
                true)));
        assertEquals(TripBoard.ARRIVAL_PENDING, lane(row("in_progress", "transit", null,
                Map.of("departure", "confirmed", "arrival", "pending"), null, PAST, LATER, true)));
        assertEquals(TripBoard.ARRIVAL_PENDING, lane(row("in_progress", "transit", null, null,
                Set.of("arrival_overdue"), PAST, PAST, true)));
        assertEquals(TripBoard.CLOSURE_PENDING, lane(row("in_progress", "unloading", "transit", null, null, PAST,
                PAST, true)));
        assertEquals(TripBoard.CLOSURE_PENDING, lane(row("in_progress", "unloading", "transit", null,
                Set.of("closure_overdue"), PAST, PAST, true)));
    }

    @Test
    void betweenStagesTheLastClosedStageAndConfirmedMilestonesMoveTheTripOn() {
        assertEquals(TripBoard.IN_TRANSIT, lane(row("in_progress", null, "preparation", null, null, PAST, LATER,
                true)));
        assertEquals(TripBoard.CLOSURE_PENDING, lane(row("in_progress", null, "transit", null, null, PAST, LATER,
                true)));
        assertEquals(TripBoard.IN_TRANSIT, lane(row("in_progress", "preparation", null,
                Map.of("departure", "confirmed"), null, PAST, LATER, true)), "no rule advanced the stage");
        assertEquals(TripBoard.CLOSURE_PENDING, lane(row("in_progress", "transit", null,
                Map.of("departure", "confirmed", "arrival", "confirmed"), null, PAST, LATER, true)));
    }

    @Test
    void finishedTripsAreCompletedRegularizedOrCancelled() {
        assertEquals(TripBoard.COMPLETED, lane(row("completed", null, "closing", null, null, PAST, PAST, true)));
        assertEquals(TripBoard.CANCELLED, lane(row("cancelled", null, null, null, null, PAST, PAST, true)));
        BoardRow regularized = new BoardRow("t1", "completed", PAST, PAST, PAST, PAST, PAST, null, "closing", null,
                null, null, null, null, null, null, null, null, null, null, null, true, null, NOW);
        assertEquals(TripBoard.REGULARIZED, lane(regularized));
    }

    @Test
    void anUnknownViewIsRefused() {
        assertEquals(6, TripBoard.lanes("dispatch").size());
        assertThrows(IllegalArgumentException.class, () -> TripBoard.lanes("kanban"));
    }
}
