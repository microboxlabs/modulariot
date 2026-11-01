package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.lostsignal.IngestHealth.Heartbeat;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/** Process-local lost-signal state, for tests and for one replica without Redis. */
public class InMemoryLossStore implements LossStore {

    private final Map<String, VehicleProfile> vehicles = new ConcurrentHashMap<>();
    private final Map<String, SenderProfile> senders = new ConcurrentHashMap<>();
    private final Map<String, Watch> watches = new ConcurrentHashMap<>();
    private final Map<String, CheckState> checks = new ConcurrentHashMap<>();
    private final Map<String, Instant> deadlines = new ConcurrentHashMap<>();
    private final Map<String, Heartbeat> beats = new ConcurrentHashMap<>();
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
    public Profiles load(String assetId, String sender) {
        return new Profiles(vehicles.get(assetId), sender == null ? null : senders.get(sender), checks.get(assetId));
    }

    @Override
    public synchronized void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile,
            Schedule schedule) {
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
                watches.remove(assetId);
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
        return new Vehicle(vehicles.get(assetId), watches.get(assetId), checks.get(assetId), deadlines.get(assetId));
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
