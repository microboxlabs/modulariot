package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class AsyncJobsFeedQueueTest {
    private boolean accepted;
    private boolean transaction;
    private boolean enqueued;
    private final Transactions tx = new Transactions() {
        public <T> T inTransaction(Supplier<T> work) {
            boolean before = accepted;
            transaction = true;
            try {
                return work.get();
            } catch (RuntimeException failure) {
                accepted = before;
                throw failure;
            } finally {
                transaction = false;
            }
        }
    };
    private final AsyncJobService jobs = new AsyncJobService(null, null, null, 1, 1) {
        @Override
        public EnqueueJobsResponse enqueue(String tenant, EnqueueJobsRequest request) {
            assertTrue(transaction);
            enqueued = true;
            return new EnqueueJobsResponse(List.of(), 1);
        }
    };
    private final AsyncJobsFeedQueue queue = new AsyncJobsFeedQueue(jobs, null, tx);

    @Test
    void duplicateJobRollsBackAcceptanceBeforeWakingWorker() {
        var job = FeedBatchService.spec("test-feed", "TEST", "test", "batch");
        assertThrows(IllegalStateException.class, () -> queue.acceptAndQueue("test", "test-feed", job, () -> {
                    assertTrue(transaction);
                    accepted = true;
                    return true;
                }));
        assertTrue(enqueued);
        assertFalse(accepted);
    }

    @Test
    void unchangedStateDoesNotEnqueueOrWakeWorker() {
        assertFalse(queue.acceptAndQueue("test", "test-feed",
                FeedBatchService.spec("test-feed", "TEST", "test", "batch"), () -> false));
        assertFalse(enqueued);
    }
}
