package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.BoardRow;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.MandateService;
import com.microboxlabs.miot.trips.service.TripService;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The board's departure and arrival times ({@code PgBoardStore}): a confirmed milestone, else the first current stage
 * en route ({@code transit}, {@code stop}) or at destination ({@code unloading}, {@code closing}). A baseline for the
 * milestone refactor. Skipped unless {@code -Dmiot.trips.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgBoardMilestoneTimesTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "ops@example.com";
    private static final OffsetDateTime T0 = OffsetDateTime.parse("2026-10-26T09:00:00Z");

    private static Vertx vertx;
    private static Pool pool;

    private final Transactions tx = new PgTransactions(() -> pool);
    private final AuditService audit = new AuditService(new PgAuditStore(() -> pool));
    private final MandateService mandates = new MandateService(new PgMandateStore(() -> pool), audit, tx);
    private final TripService trips = new TripService(new PgTripStore(() -> pool), new PgStageStore(() -> pool),
            new PgAssignmentStore(() -> pool), new PgTripCargoStore(() -> pool), new PgCargoStore(() -> pool),
            mandates, PgTripsStoresTest.projector(() -> pool), audit, tx);
    private final PgBoardStore board = new PgBoardStore(() -> pool);
    private String tenant;

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(
                PgTripsStoresTest.URL_PROPERTY))).using(vertx).build();
        PgTripsStoresTest.recreateSchemas(pool);
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @BeforeEach
    void tenant() {
        tenant = "t-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private UUID trip() {
        List<StageRequest> plan = List.of("preparation", "loading", "transit", "stop", "unloading", "closing").stream()
                .map(t -> new StageRequest(t, null, null, null, null, null)).toList();
        return UUID.fromString(trips.create(tenant, ACTOR, new TripRequest(null, null, T0, List.of(), plan, null))
                .id());
    }

    private UUID stageId(UUID trip, String type) {
        return UUID.fromString(trips.detail(tenant, trip).stages().stream().filter(s -> s.stageType().equals(type))
                .map(StageView::id).findFirst().orElseThrow());
    }

    /** Sets a stage's actual start, as if it ran; {@code minutes} after T0. */
    private void started(UUID trip, String type, int minutes) {
        Pg.query(pool, "UPDATE miot_trips.stage SET actual_start = $2 WHERE id = $1",
                Tuple.of(stageId(trip, type), T0.plusMinutes(minutes)));
    }

    private void milestone(UUID trip, String tenantCode, String name, String status, Integer minutes) {
        Pg.query(pool, """
                INSERT INTO miot_trips.trip_milestone (trip_id, milestone, tenant_code, status, confirmed_at)
                VALUES ($1, $2, $3, $4, $5)
                """, Tuple.of(trip, name, tenantCode, status, minutes == null ? null : T0.plusMinutes(minutes)));
    }

    private BoardRow row(UUID trip) {
        return board.trip(tenant, trip).orElseThrow();
    }

    private static void same(int minutes, OffsetDateTime actual) {
        assertEquals(T0.plusMinutes(minutes).toInstant(), actual == null ? null : actual.toInstant());
    }

    @Test
    void aConfirmedDepartureIsTheDepartureWhetherTransitStartedEarlierOrLater() {
        UUID earlier = trip();
        milestone(earlier, tenant, "departure", "confirmed", 30);
        started(earlier, "transit", 10);
        same(30, row(earlier).departedAt());

        UUID later = trip();
        milestone(later, tenant, "departure", "confirmed", 30);
        started(later, "stop", 50);
        same(30, row(later).departedAt());
    }

    @Test
    void aPendingRejectedOrMissingDepartureIsTheEarliestCurrentTransitOrStop() {
        for (String status : new String[] {"pending", "rejected", null}) {
            UUID trip = trip();
            if (status != null) {
                milestone(trip, tenant, "departure", status, null);
            }
            started(trip, "preparation", -60);
            started(trip, "loading", -30);
            started(trip, "transit", 40);
            started(trip, "stop", 20);
            same(20, row(trip).departedAt());
        }
    }

    @Test
    void aSupersededStageVersionIsNotTheDeparture() {
        UUID trip = trip();
        started(trip, "transit", -10);
        started(trip, "stop", 25);
        Pg.query(pool, "UPDATE miot_trips.stage SET version_of = $2 WHERE id = $1",
                Tuple.of(stageId(trip, "transit"), stageId(trip, "preparation")));
        same(25, row(trip).departedAt());
    }

    @Test
    void withoutADepartureOrAStageEnRouteThereIsNoDeparture() {
        UUID trip = trip();
        started(trip, "preparation", 0);
        started(trip, "loading", 10);
        assertNull(row(trip).departedAt());
    }

    @Test
    void aConfirmedArrivalIsTheArrivalAndOtherwiseTheFirstStageAtDestination() {
        UUID confirmed = trip();
        milestone(confirmed, tenant, "arrival", "confirmed", 300);
        started(confirmed, "unloading", 280);
        same(300, row(confirmed).arrivedAt());

        for (String status : new String[] {"pending", "rejected"}) {
            UUID trip = trip();
            milestone(trip, tenant, "arrival", status, null);
            assertNull(row(trip).arrivedAt(), status + " without a stage at destination");
            started(trip, "closing", 330);
            started(trip, "unloading", 310);
            same(310, row(trip).arrivedAt());
        }
    }

    /**
     * Unlike the symptoms queries, the board does not filter milestones by tenant: it reads them by trip id only.
     * Trip ids are UUIDs and the milestone service writes the trip's own tenant, so this cannot happen in practice;
     * pinned so a change to it is deliberate.
     */
    @Test
    void anotherTenantsMilestonesForTheSameTripIdAreReadByTheBoard() {
        UUID trip = trip();
        started(trip, "transit", 15);
        started(trip, "unloading", 200);
        milestone(trip, "other-" + tenant, "departure", "confirmed", 5);
        milestone(trip, "other-" + tenant, "arrival", "confirmed", 190);
        same(5, row(trip).departedAt());
        same(190, row(trip).arrivedAt());
    }
}
