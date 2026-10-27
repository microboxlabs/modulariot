package com.microboxlabs.miot.trips.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import com.microboxlabs.miot.trips.dto.FeedResult;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * {@code trips_feed_service}: applies one service's latest desired state. A service that cannot be created
 * (report) or a step the trips rules refuse fails the job at once (parked, visible in the console, notified by the
 * park rules); anything else is thrown so the ledger retries with backoff.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class FeedServiceJobHandler implements ModulithJobHandler {

    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    private final FeedReconciler reconciler;
    private final ObjectMapper json;

    @Inject
    public FeedServiceJobHandler(FeedReconciler reconciler, ObjectMapper json) {
        this.reconciler = reconciler;
        this.json = json;
    }

    @Override
    public String jobType() {
        return FeedBatchService.JOB_TYPE;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        String feedKey = text(payload, FeedBatchService.FEED_KEY);
        String code = text(payload, FeedBatchService.EXTERNAL_CODE);
        String actor = text(payload, FeedBatchService.ACTOR);
        if (feedKey == null || code == null) {
            throw new NonRetryableJobException("payload needs feedKey and externalCode");
        }
        FeedResult result;
        try {
            result = reconciler.recheck(tenantCode, actor == null ? "feed:" + feedKey : actor, feedKey, code);
        } catch (IllegalArgumentException | IllegalStateException | NoSuchElementException e) {
            // a lock timeout or a concurrent change surfaces as "conflict: …": a retry can pass
            if (String.valueOf(e.getMessage()).startsWith("conflict:")) {
                throw e;
            }
            throw new NonRetryableJobException(e.getMessage());
        }
        if (!result.errors().isEmpty()) {
            throw new NonRetryableJobException(String.join("; ", result.errors()));
        }
        return JobOutcome.succeeded(result.action() + ": " + result.operations().size() + " step(s)",
                json.convertValue(result, MAP));
    }

    private static String text(Map<String, Object> payload, String key) {
        Object v = payload == null ? null : payload.get(key);
        return v == null || v.toString().isBlank() ? null : v.toString();
    }
}
