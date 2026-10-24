package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
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

    @Inject
    public AsyncJobsFeedQueue(AsyncJobService jobs, ModulithJobWorker worker) {
        this.jobs = jobs;
        this.worker = worker;
    }

    @Override
    public void queue(String tenantCode, String feedKey, List<AsyncJobSpec> specs) {
        worker.onEnqueued(jobs.enqueue(tenantCode, new EnqueueJobsRequest("trips-feed:" + feedKey, "listener",
                specs)));
    }
}
