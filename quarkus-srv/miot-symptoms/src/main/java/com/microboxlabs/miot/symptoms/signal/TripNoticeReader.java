package com.microboxlabs.miot.symptoms.signal;

import io.smallrye.mutiny.Uni;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.jboss.logging.Logger;

/** Applies only the latest notified read of a trip, even when pooled queries finish out of order. */
final class TripNoticeReader {
    private static final Logger LOG = Logger.getLogger(TripNoticeReader.class);
    private final ReferenceCache refs;
    private final Function<UUID, Uni<List<ReferenceCache.Trip>>> load;
    private final Map<UUID, Object> pending = new ConcurrentHashMap<>();

    TripNoticeReader(ReferenceCache refs, Function<UUID, Uni<List<ReferenceCache.Trip>>> load) {
        this.refs = refs;
        this.load = load;
    }

    void invalidate() {
        pending.clear();
    }

    void read(UUID id) {
        Object request = new Object();
        pending.put(id, request);
        Uni.createFrom().deferred(() -> load.apply(id)).subscribe().with(rows -> {
            pending.computeIfPresent(id, (key, current) -> {
                if (current != request) return current;
                refs.applyTrip(id.toString(), rows.isEmpty() ? null : rows.getFirst());
                return null;
            });
        }, failure -> {
            pending.remove(id, request);
            LOG.warnf("Signal builder: trip %s not read again (%s)", id, failure.getClass().getSimpleName());
        });
    }
}
