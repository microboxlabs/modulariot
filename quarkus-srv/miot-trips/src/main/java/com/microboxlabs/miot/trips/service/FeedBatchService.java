package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.dto.FeedBatchRequest;
import com.microboxlabs.miot.trips.dto.FeedBatchResult;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * A feed's batch: each service whose desired state changed is kept as its latest state and queued as one async job
 * ({@code trips_feed_service}); the job applies the latest state, so jobs of one service never apply an older one.
 * Unchanged services are skipped; closed ones without a transaction, from one read of the batch's hashes. Errors land on the job (console, retry, park notifications), not on the batch.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class FeedBatchService {

    public static final String JOB_TYPE = "trips_feed_service";
    public static final String FEED_KEY = "feedKey";
    public static final String EXTERNAL_CODE = "externalCode";
    public static final String ACTOR = "actor";
    public static final String BATCH_ID = "batchId";
    static final int MAX_SERVICES = 500;

    private final FeedReconciler reconciler;
    private final FeedJobQueue queue;

    @Inject
    public FeedBatchService(FeedReconciler reconciler, FeedJobQueue queue) {
        this.reconciler = reconciler;
        this.queue = queue;
    }

    public FeedBatchResult send(String tenantCode, String actor, String feedKey, FeedBatchRequest body) {
        reconciler.profile(tenantCode, feedKey);
        List<FeedBatchRequest.Item> items = items(body);
        if (items.size() > MAX_SERVICES) {
            throw new IllegalArgumentException("a batch takes at most " + MAX_SERVICES + " services");
        }
        String batchId = body == null || body.batchId() == null || body.batchId().isBlank()
                ? UUID.randomUUID().toString() : Check.limited(body.batchId().trim(), BATCH_ID, 64);
        Map<String, FeedService.Digest> digests = reconciler.digests(tenantCode, feedKey, codes(items));
        List<String> queued = new ArrayList<>();
        List<String> unchanged = new ArrayList<>();
        List<FeedBatchResult.Refusal> refused = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (int index = 0; index < items.size(); index++) {
            FeedBatchRequest.Item item = items.get(index);
            String code = externalCode(item);
            try {
                rejectNul(rawExternalCode(item));
                FeedServiceRequest desired = item == null ? null : item.desired();
                boolean settled = firstSettled(seen, digests, code, desired);
                boolean enqueued = !settled && queue.acceptAndQueue(tenantCode, feedKey,
                        spec(feedKey, code, actor, batchId),
                        () -> reconciler.accept(tenantCode, feedKey, code, desired));
                if (enqueued) {
                    queued.add(code);
                } else {
                    unchanged.add(code);
                }
            } catch (IllegalArgumentException | IllegalStateException e) {
                refused.add(new FeedBatchResult.Refusal(index, code, e.getMessage()));
            }
        }
        return new FeedBatchResult(batchId, items.size(), queued, unchanged, refused);
    }

    private boolean firstSettled(Set<String> seen, Map<String, FeedService.Digest> digests, String code,
            FeedServiceRequest desired) {
        return seen.add(code) && reconciler.settled(digests.get(code), desired);
    }

    private static String externalCode(FeedBatchRequest.Item item) {
        String raw = rawExternalCode(item);
        return raw == null ? "" : raw.trim();
    }

    private static String rawExternalCode(FeedBatchRequest.Item item) {
        return item == null ? null : item.externalCode();
    }

    private static void rejectNul(String code) {
        if (code != null && code.indexOf('\0') >= 0) {
            throw new IllegalArgumentException("externalCode must not contain NUL");
        }
    }

    private static Set<String> codes(List<FeedBatchRequest.Item> items) {
        Set<String> codes = new HashSet<>();
        for (FeedBatchRequest.Item item : items) {
            String raw = rawExternalCode(item);
            if (raw != null && !raw.isBlank() && raw.indexOf('\0') < 0) {
                codes.add(raw.trim());
            }
        }
        return codes;
    }

    private static List<FeedBatchRequest.Item> items(FeedBatchRequest body) {
        return body == null || body.services() == null ? List.of() : body.services();
    }

    /** The job of one service: no chain (a failed job must not hold back the next state); one per batch. */
    static AsyncJobSpec spec(String feedKey, String code, String actor, String batchId) {
        return new AsyncJobSpec(JOB_TYPE, ModulithJobHandler.EXECUTOR, code, null, null,
                "trips-feed:" + feedKey + ":" + code.replace("%", "%25").replace(":", "%3A") + ":" + batchId,
                Map.of(FEED_KEY, feedKey, EXTERNAL_CODE, code, ACTOR, actor == null ? "feed:" + feedKey : actor,
                        BATCH_ID, batchId),
                null);
    }
}
