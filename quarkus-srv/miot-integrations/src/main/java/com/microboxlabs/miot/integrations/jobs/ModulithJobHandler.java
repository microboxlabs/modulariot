package com.microboxlabs.miot.integrations.jobs;

import java.util.Map;

/**
 * A unit of async-job work that runs inside the modulith (async-job executor
 * lane {@link #EXECUTOR}), off ECM.
 *
 * <p>Register one {@code @ApplicationScoped} implementation per job type;
 * {@link ModulithJobWorker} discovers them all via CDI and dispatches by
 * {@link #jobType()} — adding a job type is a new bean, not a new branch in the
 * worker. Mirrors the {@code ConnectionTesterRegistry} idiom.
 */
public interface ModulithJobHandler {

    /**
     * The async-job {@code executor} lane these handlers claim. ECM claims only
     * {@code "ecm"}; a job is routed here by ECM stamping {@code executor=modulith}
     * on enqueue. The two lanes never collide.
     */
    String EXECUTOR = "modulith";

    /** The async-job {@code job_type} this handler executes. Unique across handlers. */
    String jobType();

    /**
     * Whether the handler is currently configured to run (e.g. its downstream URL
     * is set). A not-ready handler's jobs are left for a later run rather than
     * executed. Defaults to always-ready.
     */
    default boolean isReady() {
        return true;
    }

    /**
     * Execute the job from its self-contained payload. Return the terminal
     * outcome (SUCCEEDED/SKIPPED); throw for a retryable failure.
     *
     * @param tenantCode the job row's tenant — the Auth0 M2M client id every
     *        tenant-scoped lookup (bindings, connections) is keyed on. From the
     *        ledger, not the payload: a payload cannot claim another tenant.
     */
    JobOutcome handle(String tenantCode, Map<String, Object> payload);
}
