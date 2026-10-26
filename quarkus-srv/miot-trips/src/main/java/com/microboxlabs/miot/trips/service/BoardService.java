package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.BoardRow;
import com.microboxlabs.miot.trips.dto.BoardView;
import com.microboxlabs.miot.trips.store.BoardStore;
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

    private final BoardStore board;
    private final FleetResources fleet;
    private final Clock clock;

    @Inject
    public BoardService(BoardStore board, FleetResources fleet) {
        this(board, fleet, Clock.systemUTC());
    }

    public BoardService(BoardStore board, FleetResources fleet, Clock clock) {
        this.board = board;
        this.fleet = fleet;
        this.clock = clock;
    }

    /** {@code from} and {@code to} only apply to the finished view; the default is the last seven days. */
    public BoardView view(String tenantCode, String view, String q, OffsetDateTime from, OffsetDateTime to,
            Integer limit) {
        List<String> lanes = TripBoard.lanes(view);
        int perLane = limit == null ? DEFAULT_LIMIT : Math.clamp(limit, 1, MAX_LIMIT);
        String query = q == null || q.isBlank() ? null : Check.limited(q.trim(), "q", 100);
        OffsetDateTime now = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        List<BoardRow> rows;
        Comparator<BoardRow> order;
        if (TripBoard.FINISHED.equals(view)) {
            OffsetDateTime end = to == null ? now : to;
            OffsetDateTime start = from == null ? end.minus(FINISHED_DEFAULT) : from;
            if (!start.isBefore(end) || Duration.between(start, end).compareTo(FINISHED_MAX) > 0) {
                throw new IllegalArgumentException("from must be before to, at most 93 days apart");
            }
            rows = resolveResources(tenantCode,
                    board.finished(tenantCode, query, start, end, perLane * lanes.size()));
            order = Comparator.comparing((BoardRow r) -> r.actualEnd() == null ? r.updatedAt() : r.actualEnd(),
                    Comparator.nullsLast(Comparator.reverseOrder()));
        } else {
            rows = board.open(tenantCode, query);
            Function<BoardRow, OffsetDateTime> due = TripBoard.PLANNING.equals(view) ? BoardRow::plannedStart
                    : BoardRow::plannedArrival;
            order = Comparator.comparing(due, Comparator.nullsLast(Comparator.naturalOrder()));
        }
        Map<String, List<BoardRow>> byLane = new LinkedHashMap<>();
        lanes.forEach(lane -> byLane.put(lane, new ArrayList<>()));
        for (BoardRow row : rows) {
            List<BoardRow> lane = byLane.get(TripBoard.lane(row, now));
            if (lane != null) {
                lane.add(row);
            }
        }
        List<BoardView.Lane> out = byLane.entrySet().stream().map(e -> new BoardView.Lane(e.getKey(),
                e.getValue().size(), e.getValue().stream().sorted(order).limit(perLane)
                        .map(r -> BoardView.Card.of(r, e.getKey())).toList()))
                .toList();
        return new BoardView(view, out, now);
    }

    /** A finished trip carries resource ids; the card shows the plate, the driver and the truck's carrier. */
    private List<BoardRow> resolveResources(String tenantCode, List<BoardRow> rows) {
        Map<String, Optional<FleetResources.Vehicle>> trucks = new HashMap<>();
        Map<String, Optional<FleetResources.Driver>> drivers = new HashMap<>();
        Map<UUID, Optional<FleetResources.Carrier>> carriers = new HashMap<>();
        return rows.stream().map(r -> {
            Optional<FleetResources.Vehicle> truck = r.truck() == null ? Optional.empty()
                    : trucks.computeIfAbsent(r.truck(), id -> Optional.ofNullable(Pg.parse(id))
                            .flatMap(u -> fleet.vehicle(tenantCode, Assignment.TRUCK, u)));
            Optional<FleetResources.Driver> driver = r.driver() == null ? Optional.empty()
                    : drivers.computeIfAbsent(r.driver(), id -> Optional.ofNullable(Pg.parse(id))
                            .flatMap(u -> fleet.driver(tenantCode, u)));
            Optional<FleetResources.Carrier> carrier = truck.map(FleetResources.Vehicle::carrierId)
                    .flatMap(id -> carriers.computeIfAbsent(id, c -> fleet.carrier(tenantCode, c)));
            return r.withResources(truck.map(FleetResources.Vehicle::licensePlate).orElse(null),
                    driver.map(FleetResources.Driver::fullName).orElse(null),
                    carrier.map(FleetResources.Carrier::legalName).orElse(null));
        }).toList();
    }
}
