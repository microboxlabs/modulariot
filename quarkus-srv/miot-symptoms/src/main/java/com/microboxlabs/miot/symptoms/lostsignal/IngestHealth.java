package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Whether our own ingest keeps up, from the heartbeats every evaluator replica writes: when it last read a
 * signal and how far behind the signal's publish time it read it. When nothing was read for {@code staleAfter},
 * or a replica reads more than {@code maxLag} behind, a silence may be ours, so the ticker pauses.
 * {@code staleAfter} zero turns the guard off.
 */
public record IngestHealth(Duration staleAfter, Duration maxLag) {

    /** One replica's last signal: when it read it and how far behind its publish time. */
    public record Heartbeat(String owner, Instant at, Duration lag) {
    }

    /** Why the ticker should pause, or empty when ingest keeps up. */
    public Optional<String> pause(List<Heartbeat> beats, Instant now) {
        if (staleAfter.isZero()) {
            return Optional.empty();
        }
        Instant newest = beats.stream().map(Heartbeat::at).max(Instant::compareTo).orElse(null);
        if (newest == null || Duration.between(newest, now).compareTo(staleAfter) > 0) {
            return Optional.of("stale");
        }
        boolean behind = beats.stream()
                .filter(b -> Duration.between(b.at(), now).compareTo(staleAfter) <= 0)
                .anyMatch(b -> b.lag().compareTo(maxLag) > 0);
        return behind ? Optional.of("lag") : Optional.empty();
    }
}
