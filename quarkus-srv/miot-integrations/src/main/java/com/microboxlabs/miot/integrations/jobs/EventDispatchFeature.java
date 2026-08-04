package com.microboxlabs.miot.integrations.jobs;

/**
 * Payload keys and identifiers for event dispatch, in one place so the enqueuer and the
 * handler cannot disagree about them (house style, per {@code CalendarConfirmFeature} and
 * {@code JobFailureNotificationFeature}).
 */
public final class EventDispatchFeature {

    /** Fits {@code async_jobs.job_type VARCHAR(64)} at 26 characters. */
    public static final String JOB_TYPE = "integration_event_dispatch";

    /**
     * The owning tenant. Carried in the payload because {@code ModulithJobHandler.handle}
     * receives only that — the job row knows its tenant, the handler does not.
     */
    public static final String PAYLOAD_TENANT_CLIENT_ID = "tenantClientId";

    /** Which binding to deliver through. */
    public static final String PAYLOAD_BINDING_ID = "bindingId";
    /** Echoed for the console; the binding is the authority. */
    public static final String PAYLOAD_EVENT_TYPE = "eventType";
    public static final String PAYLOAD_SCOPE_KIND = "scopeKind";
    public static final String PAYLOAD_SCOPE_KEY = "scopeKey";

    /**
     * The rendered context snapshot: {@code {task, content, review, session}}.
     *
     * <p>Captured at intake and never re-read. A retry hours later must send the state that
     * was reviewed, not whatever the task looks like now — and the worker thread has no user,
     * so {@code session} (the reviewer) could not be recovered at dispatch time even in
     * principle.
     */
    public static final String PAYLOAD_CONTEXT = "context";

    /**
     * Optional: an event type whose <b>fetch-shaped</b> binding completes the context
     * before rendering — for producers whose snapshot carries opaque resource ids that
     * partner templates cannot use directly (the fetch resolves them into the fields the
     * templates read). Resolved through {@code EventBindingFetchService} with the
     * dispatch's own scope and context, so which connection answers and how fields map
     * in both directions stays operator-authored binding config. Absent → the snapshot
     * renders unchanged, exactly as before this key existed.
     */
    public static final String PAYLOAD_ENRICHMENT_EVENT = "enrichmentEvent";

    /**
     * Optional companion to {@link #PAYLOAD_ENRICHMENT_EVENT}: the context key whose
     * map receives the fetched values (created if absent). Absent → fetched values merge
     * at the context root. Fetched values win over the snapshot's own — a fresh
     * resolution beats what rode along.
     */
    public static final String PAYLOAD_ENRICHMENT_MERGE_KEY = "enrichmentMergeKey";

    private EventDispatchFeature() {
    }
}
