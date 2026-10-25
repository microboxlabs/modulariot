package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.rules.SendQueue;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.jobs.ModulithJobWorker;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;

/** The rules engine's messages as integration jobs, enqueued by the listener and drained right away. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class RuleSendQueue implements SendQueue {

    static final String SOURCE = "conversation-rules";
    static final String ENQUEUED_BY = "listener";

    private final AsyncJobService jobs;
    private final ModulithJobWorker worker;

    @Inject
    public RuleSendQueue(AsyncJobService jobs, ModulithJobWorker worker) {
        this.jobs = jobs;
        this.worker = worker;
    }

    @Override
    public void enqueue(String tenantCode, List<AsyncJobSpec> specs) {
        EnqueueJobsResponse response = jobs.enqueue(tenantCode, new EnqueueJobsRequest(SOURCE, ENQUEUED_BY, specs));
        worker.onEnqueued(response);
    }
}
