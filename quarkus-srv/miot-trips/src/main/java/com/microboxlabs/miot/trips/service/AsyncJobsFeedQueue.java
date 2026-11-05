package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.core.db.Transactions;
import java.util.function.BooleanSupplier;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.jobs.ModulithJobWorker;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;

/** {@link FeedJobQueue} on the async-jobs ledger; kicks the modulith worker so the jobs start at once. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class AsyncJobsFeedQueue implements FeedJobQueue {

    private final AsyncJobService jobs;
    private final ModulithJobWorker worker;
    private final Transactions tx;

    @Inject
    public AsyncJobsFeedQueue(AsyncJobService jobs, ModulithJobWorker worker, Transactions tx) {
        this.jobs = jobs;
        this.worker = worker;
        this.tx = tx;
    }

    @Override
    public void queue(String tenantCode, String feedKey, List<AsyncJobSpec> specs) {
        worker.onEnqueued(jobs.enqueue(tenantCode, new EnqueueJobsRequest("trips-feed:" + feedKey, "listener",
                specs)));
    }
    @Override
    public boolean acceptAndQueue(String tenantCode, String feedKey, AsyncJobSpec job, BooleanSupplier accept) {
        EnqueueJobsResponse response = tx.inTransaction(() -> {
            if (!accept.getAsBoolean()) {
                return null;
            }
            EnqueueJobsResponse result = jobs.enqueue(tenantCode,
                    new EnqueueJobsRequest("trips-feed:" + feedKey, "listener", List.of(job)));
            if (result.duplicates() > 0) {
                throw new IllegalStateException("feed job already exists for this batch");
            }
            return result;
        });
        if (response == null) {
            return false;
        }
        // Wake the worker only after both the desired state and ledger row have committed.
        worker.onEnqueued(response);
        return true;
    }

}
