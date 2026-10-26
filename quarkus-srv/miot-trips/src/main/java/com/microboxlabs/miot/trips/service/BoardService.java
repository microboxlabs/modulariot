package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.BoardRow;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.dto.BoardView;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.dto.TripSheet;
import com.microboxlabs.miot.trips.store.BoardStore;
import com.microboxlabs.miot.trips.store.ConfirmerStore;
import com.microboxlabs.miot.trips.store.MonitorRunStore;
import com.microboxlabs.miot.trips.store.StageStore;
import com.microboxlabs.miot.trips.store.Pg;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

/** Builds a board view: every trip of the view placed in its lane, lanes in order, the first cards of each. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class BoardService {

    public static final int DEFAULT_LIMIT = 100;
    public static final int MAX_LIMIT = 500;
    private static final Duration FINISHED_DEFAULT = Duration.ofDays(7);
    private static final Duration FINISHED_MAX = Duration.ofDays(93);

    private record ViewRows(List<BoardRow> rows, Comparator<BoardRow> order, Map<String, Integer> counts) {
    }

    private final BoardStore board;
    private final FleetResources fleet;
    private final StageStore stages;
    private final MilestoneService milestones;
    private final MonitorRunStore runs;
    private final ConfirmerStore confirmers;
    private final DeliveryService deliveries;
    private final Clock clock;

    @Inject
    public BoardService(BoardStore board, FleetResources fleet, StageStore stages, MilestoneService milestones,
            MonitorRunStore runs, ConfirmerStore confirmers, DeliveryService deliveries) {
        this(board, fleet, stages, milestones, runs, confirmers, deliveries, Clock.systemUTC());
    }

    /** Without deliveries: the trip page leaves them out. */
    public BoardService(BoardStore board, FleetResources fleet, StageStore stages, MilestoneService milestones,
            MonitorRunStore runs, ConfirmerStore confirmers) {
        this(board, fleet, stages, milestones, runs, confirmers, null, Clock.systemUTC());
    }

    public BoardService(BoardStore board, FleetResources fleet, StageStore stages, MilestoneService milestones,
            MonitorRunStore runs, ConfirmerStore confirmers, Clock clock) {
        this(board, fleet, stages, milestones, runs, confirmers, null, clock);
    }

    @SuppressWarnings("java:S107") // The CDI constructor plus the clock, for tests.
    public BoardService(BoardStore board, FleetResources fleet, StageStore stages, MilestoneService milestones,
            MonitorRunStore runs, ConfirmerStore confirmers, DeliveryService deliveries, Clock clock) {
        this.deliveries = deliveries;
        this.board = board;
        this.fleet = fleet;
        this.stages = stages;
        this.milestones = milestones;
        this.runs = runs;
        this.confirmers = confirmers;
        this.clock = clock;
    }

    /** One trip's page: its card, plan, milestones, the last 50 transitions, the feed's row and the deliveries. */
    public TripSheet sheet(String tenantCode, UUID tripId) {
        BoardRow row = board.trip(tenantCode, tripId)
                .orElseThrow(() -> new NoSuchElementException("trip not found"));
        if (Trip.DONE.equals(row.status()) || Trip.CANCELLED.equals(row.status())) {
            row = resolveResources(tenantCode, List.of(row)).get(0);
        }
        OffsetDateTime now = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        return new TripSheet(BoardView.Card.of(row, TripBoard.lane(row, now)),
                stages.listBySubject(tenantCode, Stage.SUBJECT_TRIP, tripId).stream()
                        .sorted(Comparator.comparingInt(Stage::seq)).map(StageView::of).toList(),
                milestones.list(tenantCode, tripId), confirmers.ofTrip(tenantCode, tripId),
                runs.transitions(tenantCode, tripId, 50),
                board.feedSource(tenantCode, tripId).orElse(null),
                deliveries == null ? null : deliveries.list(tenantCode, tripId));
    }

    /** How many trips each view shows without a filter: the open trips in its lanes, the last seven days' finished. */
    public Map<String, Integer> counts(String tenantCode) {
        OffsetDateTime now = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        Map<String, Integer> counts = new LinkedHashMap<>();
        List.of(TripBoard.PLANNING, TripBoard.DISPATCH, TripBoard.DELIVERY).forEach(v -> counts.put(v, 0));
        for (BoardRow row : board.open(tenantCode, null)) {
            for (String view : List.copyOf(counts.keySet())) {
                String lane = TripBoard.lane(row, view, now);
                if (lane != null && TripBoard.LANES.get(view).contains(lane)) {
                    counts.merge(view, 1, Integer::sum);
                }
            }
        }
        counts.put(TripBoard.FINISHED, board.finishedCount(tenantCode, now.minus(FINISHED_DEFAULT), now));
        return counts;
    }

    /** {@code from} and {@code to} only apply to the finished view; the default is the last seven days. */
    public BoardView view(String tenantCode, String view, String q, OffsetDateTime from, OffsetDateTime to,
            Integer limit) {
        List<String> lanes = TripBoard.lanesForView(view);
        int perLane = limit == null ? DEFAULT_LIMIT : Math.clamp(limit, 1, MAX_LIMIT);
        String query = q == null || q.isBlank() ? null : Check.limited(q.trim(), "q", 100);
        OffsetDateTime now = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        ViewRows selected = viewRows(tenantCode, view, query, from, to, perLane, now);
        Map<String, List<BoardRow>> byLane = new LinkedHashMap<>();
        lanes.forEach(lane -> byLane.put(lane, new ArrayList<>()));
        for (BoardRow row : selected.rows()) {
            String key = TripBoard.lane(row, view, now);
            List<BoardRow> lane = key == null ? null : byLane.get(key);
            if (lane != null) {
                lane.add(row);
            }
        }
        List<BoardView.Lane> out = byLane.entrySet().stream().map(e -> new BoardView.Lane(e.getKey(),
                selected.counts().getOrDefault(e.getKey(), e.getValue().size()),
                e.getValue().stream().sorted(selected.order()).limit(perLane)
                        .map(r -> BoardView.Card.of(r, e.getKey())).toList()))
                .toList();
        return new BoardView(view, out, now);
    }

    private ViewRows viewRows(String tenantCode, String view, String query, OffsetDateTime from, OffsetDateTime to,
            int perLane, OffsetDateTime now) {
        if (TripBoard.FINISHED.equals(view)) {
            return finishedRows(tenantCode, query, from, to, perLane, now);
        }
        Function<BoardRow, OffsetDateTime> due = TripBoard.PLANNING.equals(view) ? BoardRow::plannedStart
                : BoardRow::plannedArrival;
        return new ViewRows(board.open(tenantCode, query),
                Comparator.comparing(due, Comparator.nullsLast(Comparator.naturalOrder())), Map.of());
    }

    private ViewRows finishedRows(String tenantCode, String query, OffsetDateTime from, OffsetDateTime to,
            int perLane, OffsetDateTime now) {
        OffsetDateTime end = to == null ? now : to;
        OffsetDateTime start = from == null ? end.minus(FINISHED_DEFAULT) : from;
        if (!start.isBefore(end) || Duration.between(start, end).compareTo(FINISHED_MAX) > 0) {
            throw new IllegalArgumentException("from must be before to, at most 93 days apart");
        }
        BoardStore.FinishedPage page = board.finished(tenantCode, query, start, end, perLane);
        Comparator<BoardRow> order = Comparator.comparing(
                (BoardRow r) -> r.actualEnd() == null ? r.updatedAt() : r.actualEnd(),
                Comparator.nullsLast(Comparator.reverseOrder()));
        return new ViewRows(resolveResources(tenantCode, page.rows()), order, page.counts());
    }

    /** A finished trip carries resource ids; the card shows the plate, the driver and the truck's carrier. */
    private List<BoardRow> resolveResources(String tenantCode, List<BoardRow> rows) {
        Map<String, Optional<FleetResources.Vehicle>> trucks = new HashMap<>();
        Map<String, Optional<FleetResources.Vehicle>> trailers = new HashMap<>();
        Map<String, Optional<FleetResources.Driver>> drivers = new HashMap<>();
        Map<UUID, Optional<FleetResources.Carrier>> carriers = new HashMap<>();
        return rows.stream().map(r -> {
            Optional<FleetResources.Vehicle> truck = r.truck() == null ? Optional.empty()
                    : trucks.computeIfAbsent(r.truck(), id -> Optional.ofNullable(Pg.parse(id))
                            .flatMap(u -> fleet.vehicle(tenantCode, Assignment.TRUCK, u)));
            Optional<FleetResources.Vehicle> trailer = r.trailer() == null ? Optional.empty()
                    : trailers.computeIfAbsent(r.trailer(), id -> Optional.ofNullable(Pg.parse(id))
                            .flatMap(u -> fleet.vehicle(tenantCode, Assignment.TRAILER, u)));
            Optional<FleetResources.Driver> driver = r.driver() == null ? Optional.empty()
                    : drivers.computeIfAbsent(r.driver(), id -> Optional.ofNullable(Pg.parse(id))
                            .flatMap(u -> fleet.driver(tenantCode, u)));
            Optional<FleetResources.Driver> secondDriver = r.secondDriver() == null ? Optional.empty()
                    : drivers.computeIfAbsent(r.secondDriver(), id -> Optional.ofNullable(Pg.parse(id))
                            .flatMap(u -> fleet.driver(tenantCode, u)));
            Optional<FleetResources.Carrier> carrier = truck.map(FleetResources.Vehicle::carrierId)
                    .flatMap(id -> carriers.computeIfAbsent(id, c -> fleet.carrier(tenantCode, c)));
            return r.withResources(truck.map(FleetResources.Vehicle::licensePlate).orElse(null),
                    trailer.map(FleetResources.Vehicle::licensePlate).orElse(null),
                    driver.map(FleetResources.Driver::fullName).orElse(null),
                    secondDriver.map(FleetResources.Driver::fullName).orElse(null),
                    carrier.map(FleetResources.Carrier::legalName).orElse(null));
        }).toList();
    }
}
