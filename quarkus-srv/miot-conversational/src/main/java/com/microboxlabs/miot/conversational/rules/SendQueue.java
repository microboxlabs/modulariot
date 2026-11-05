package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import java.util.List;

/** Where the rules engine puts the messages of a step: integration jobs that send them, with retries. */
@FunctionalInterface
public interface SendQueue {

    void enqueue(String tenantCode, List<AsyncJobSpec> jobs);
}
