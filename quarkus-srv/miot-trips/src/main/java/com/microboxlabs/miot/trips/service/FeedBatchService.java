package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.trips.dto.FeedBatchRequest;
import com.microboxlabs.miot.trips.dto.FeedBatchResult;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A feed's batch: each service whose desired state changed is kept as its latest state and queued as one async job
 * ({@code trips_feed_service}); the job applies the latest state, so jobs of one service never apply an older one.
 * Unchanged services are skipped. Errors land on the job (console, retry, park notifications), not on the batch.
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
        List<FeedBatchRequest.Item> items = body == null || body.services() == null ? List.of() : body.services();
        if (items.size() > MAX_SERVICES) {
            throw new IllegalArgumentException("a batch takes at most " + MAX_SERVICES + " services");
        }
        String batchId = body == null || body.batchId() == null || body.batchId().isBlank()
                ? UUID.randomUUID().toString() : Check.limited(body.batchId().trim(), BATCH_ID, 64);
        List<String> queued = new ArrayList<>();
        List<String> unchanged = new ArrayList<>();
        Map<String, String> refused = new LinkedHashMap<>();
        List<AsyncJobSpec> specs = new ArrayList<>();
        for (FeedBatchRequest.Item item : items) {
            String code = item == null || item.externalCode() == null ? "" : item.externalCode().trim();
            try {
                if (!reconciler.accept(tenantCode, feedKey, code, item == null ? null : item.desired())) {
                    unchanged.add(code);
                    continue;
                }
                queued.add(code);
                specs.add(spec(feedKey, code, actor, batchId));
            } catch (IllegalArgumentException | IllegalStateException e) {
                refused.put(code, e.getMessage());
            }
        }
        if (!specs.isEmpty()) {
            queue.queue(tenantCode, feedKey, specs);
        }
        return new FeedBatchResult(batchId, items.size(), queued, unchanged, refused);
    }

    /** The job of one service: no chain (a failed job must not hold back the next state); one per batch. */
    static AsyncJobSpec spec(String feedKey, String code, String actor, String batchId) {
        return new AsyncJobSpec(JOB_TYPE, ModulithJobHandler.EXECUTOR, code, null, null,
                "trips-feed:" + feedKey + ":" + code + ":" + batchId,
                Map.of(FEED_KEY, feedKey, EXTERNAL_CODE, code, ACTOR, actor == null ? "feed:" + feedKey : actor,
                        BATCH_ID, batchId),
                null);
    }
}
