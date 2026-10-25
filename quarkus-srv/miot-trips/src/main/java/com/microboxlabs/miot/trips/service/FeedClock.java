package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.store.FeedStore;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * The feeds' clock: queues a {@code trips_feed_service} job for each open service whose departure or close time
 * passed, or that failed or was reported a while ago, so those transitions need no new send from the feed. Each
 * modulith replica runs it; the dedupe key holds one job per service per tick.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class FeedClock {

    private static final Logger LOG = Logger.getLogger(FeedClock.class);

    private final FeedStore feeds;
    private final FeedJobQueue queue;
    private final Clock clock;
    private final boolean enabled;
    private final int tickMinutes;
    private final int retryMinutes;
    private final int limit;

    @Inject
    FeedClock(FeedStore feeds, FeedJobQueue queue,
            @ConfigProperty(name = "miot.trips.feeds.clock.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.trips.feeds.clock.tick-minutes", defaultValue = "5") int tickMinutes,
            @ConfigProperty(name = "miot.trips.feeds.clock.retry-minutes", defaultValue = "60") int retryMinutes,
            @ConfigProperty(name = "miot.trips.feeds.clock.limit", defaultValue = "200") int limit) {
        this(feeds, queue, Clock.systemUTC(), enabled, tickMinutes, retryMinutes, limit);
    }

    public FeedClock(FeedStore feeds, FeedJobQueue queue, Clock clock, boolean enabled, int tickMinutes,
            int retryMinutes, int limit) {
        this.feeds = feeds;
        this.queue = queue;
        this.clock = clock;
        this.enabled = enabled;
        this.tickMinutes = Math.max(tickMinutes, 1);
        this.retryMinutes = retryMinutes;
        this.limit = limit;
    }

    @Scheduled(every = "${miot.trips.feeds.clock.every:5m}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduled() {
        if (enabled) {
            try {
                tick();
            } catch (RuntimeException e) {
                LOG.error("feeds clock tick failed", e);
            }
        }
    }

    /** Queues the due services, grouped by tenant and feed; returns how many. */
    public int tick() {
        OffsetDateTime now = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        String tick = "clock-" + now.toEpochSecond() / 60 / tickMinutes;
        Map<String, List<AsyncJobSpec>> byFeed = new LinkedHashMap<>();
        List<FeedService> due = feeds.dueServices(now, retryMinutes, limit);
        for (FeedService s : due) {
            byFeed.computeIfAbsent(s.tenantCode() + "\n" + s.feedKey(), k -> new ArrayList<>())
                    .add(FeedBatchService.spec(s.feedKey(), s.externalCode(), "feed:" + s.feedKey() + ":clock", tick));
        }
        byFeed.forEach((key, specs) -> {
            String[] tenantAndFeed = key.split("\n", 2);
            queue.queue(tenantAndFeed[0], tenantAndFeed[1], specs);
        });
        return due.size();
    }
}
