package com.microboxlabs.miot.integrations.jobs;

import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Test doubles for {@link ModulithJobWorker}, exported here because its
 * constructors are package-private and the park hooks that inject it live in
 * other packages.
 */
public final class TestWorkers {

    private TestWorkers() {
    }

    /** Records {@link #onEnqueued} kicks without claiming or running anything. */
    public static class RecordingWorker extends ModulithJobWorker {

        public final List<EnqueueJobsResponse> kicks = new ArrayList<>();

        public RecordingWorker(AsyncJobService service) {
            super(service, Map.of(), false, 1, 60);
        }

        @Override
        public void onEnqueued(EnqueueJobsResponse response) {
            kicks.add(response);
        }
    }
}
