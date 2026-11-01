package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.lostsignal.IngestHealth.Heartbeat;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Process-local lost-signal state, for tests and for one replica without Redis. */
public class InMemoryLossStore implements LossStore {

    private final Map<String, VehicleProfile> vehicles = new ConcurrentHashMap<>();
    private final Map<String, SenderProfile> senders = new ConcurrentHashMap<>();
    private final Map<String, Watch> watches = new ConcurrentHashMap<>();
    private final Map<String, CheckState> checks = new ConcurrentHashMap<>();
    private final Map<String, Instant> deadlines = new ConcurrentHashMap<>();
    private final Map<String, Heartbeat> beats = new ConcurrentHashMap<>();
    private final Map<String, Mark> marks = new ConcurrentHashMap<>();
    private final Map<String, Coverage> coverage = new ConcurrentHashMap<>();
    private final Map<String, Cells> reporting = new ConcurrentHashMap<>();
    private final Map<String, Instant> reportedAt = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> lost = new ConcurrentHashMap<>();
    private final Map<String, Cohort> cohorts = new ConcurrentHashMap<>();
    private final Clock clock;
    private String leaseOwner;
    private Instant leaseUntil = Instant.MIN;

    public InMemoryLossStore() {
        this(Clock.systemUTC());
    }

    public InMemoryLossStore(Clock clock) {
        this.clock = clock;
    }

    @Override
    public Profiles load(String assetId, String sender, String cell) {
        return new Profiles(vehicles.get(assetId), sender == null ? null : senders.get(sender), checks.get(assetId),
                cell == null || sender == null ? null : coverage.get(sender + "/" + cell),
                cell == null ? null : coverage.get("*/" + cell));
    }

    @Override
    public synchronized void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile,
            Schedule schedule, Mark mark, Cells cells) {
        if (cells != null && cells.cell() != null) {
            if (sender != null) {
                coverage.put(sender + "/" + cells.cell(), cells.bySender());
            }
            coverage.put("*/" + cells.cell(), cells.byAll());
        }
        if (cells != null && cells.latitude() != null) {
            reporting.put(assetId, cells);
            // The frame's arrival, not the save: a backlog does not make a report look fresh.
            reportedAt.put(assetId, vehicle.arrival());
        }
        if (mark != null) {
            marks.merge(assetId, mark, (old, m) -> !old.lostSince().equals(m.lostSince()) ? m
                    : new Mark(m.lostSince(), old.returnedAt() != null ? old.returnedAt() : m.returnedAt(),
                            old.backfill() || m.backfill()));
        }
        vehicles.put(assetId, vehicle);
        if (sender != null) {
            senders.put(sender, senderProfile);
        }
        switch (schedule.kind()) {
            case DROP -> {
                watches.remove(assetId);
                deadlines.remove(assetId);
            }
            case AT -> {
                watches.put(assetId, schedule.watch());
                deadlines.put(assetId, schedule.at());
            }
            case CLEAR -> {
                watches.put(assetId, schedule.watch());
                deadlines.put(assetId, schedule.at());
            }
            case KEEP -> {
                // a late frame or a replay leaves the deadline and the watch
            }
        }
    }

    @Override
    public List<String> due(Instant now, int limit) {
        return deadlines.entrySet().stream().filter(e -> !e.getValue().isAfter(now))
                .sorted(Map.Entry.comparingByValue()).limit(limit).map(Map.Entry::getKey).toList();
    }

    @Override
    public synchronized Vehicle vehicle(String assetId) {
        CheckState c = checks.get(assetId);
        Mark m = marks.get(assetId);
        boolean current = c != null && c.lost() && m != null && m.lostSince().equals(c.lostSince());
        return new Vehicle(vehicles.get(assetId), watches.get(assetId), c, current ? m.returnedAt() : null,
                current && m.backfill(), deadlines.get(assetId));
    }

    @Override
    public synchronized boolean checked(String assetId, Instant seen, CheckState check, Instant next) {
        if (!Objects.equals(seen, deadlines.get(assetId))) {
            return false;
        }
        if (CheckState.NONE.equals(check)) {
            checks.remove(assetId);
        } else {
            checks.put(assetId, check);
        }
        if (!check.lost()) {
            marks.remove(assetId);
        }
        if (next == null) {
            deadlines.remove(assetId);
        } else {
            deadlines.computeIfPresent(assetId, (k, old) -> next);
        }
        return true;
    }

    /** The deadline of the vehicle, or null when it has none. */
    public Instant deadline(String assetId) {
        return deadlines.get(assetId);
    }

    @Override
    public Around around(String sender, String cell, Double latitude, Double longitude, String assetId, Instant now,
            double radiusKm) {
        int nearby = 0;
        if (latitude != null && longitude != null) {
            for (Map.Entry<String, Cells> e : reporting.entrySet()) {
                Instant at = reportedAt.get(e.getKey());
                if (!e.getKey().equals(assetId) && at != null && !at.isBefore(now.minusSeconds(600))
                        && km(latitude, longitude, e.getValue().latitude(), e.getValue().longitude()) <= radiusKm) {
                    nearby++;
                }
            }
        }
        return new Around(cell == null || sender == null ? null : coverage.get(sender + "/" + cell),
                cell == null ? null : coverage.get("*/" + cell), nearby);
    }

    static double km(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
        return 2 * 6371 * Math.asin(Math.sqrt(a));
    }

    @Override
    public int lost(String sender, String assetId, boolean isLost) {
        Set<String> set = lost.computeIfAbsent(sender, k -> ConcurrentHashMap.newKeySet());
        if (isLost) {
            set.add(assetId);
        } else {
            set.remove(assetId);
        }
        return new HashSet<>(set).size();
    }

    @Override
    public SenderProfile sender(String sender) {
        return senders.get(sender);
    }

    @Override
    public Cohort cohort(String sender) {
        return cohorts.get(sender);
    }

    @Override
    public void cohort(String sender, Cohort cohort) {
        cohorts.put(sender, cohort);
    }

    @Override
    public synchronized boolean lease(String owner, Duration ttl) {
        Instant now = clock.instant();
        if (leaseOwner == null || owner.equals(leaseOwner) || now.isAfter(leaseUntil)) {
            leaseOwner = owner;
            leaseUntil = now.plus(ttl);
            return true;
        }
        return false;
    }

    @Override
    public void heartbeat(Heartbeat beat) {
        beats.put(beat.owner(), beat);
    }

    @Override
    public List<Heartbeat> heartbeats() {
        return List.copyOf(beats.values());
    }
}
