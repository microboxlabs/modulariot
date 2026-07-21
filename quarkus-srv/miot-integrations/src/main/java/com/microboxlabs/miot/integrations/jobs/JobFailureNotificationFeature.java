package com.microboxlabs.miot.integrations.jobs;

/**
 * Constants for the modulith-executed {@code job_failure_notification} job:
 * message a rule's recipients that a job of theirs parked as FAILED.
 *
 * <p>The payload is fully self-contained (a {@link ModulithJobHandler} sees
 * only the payload, not the job row) — including {@code tenantCode}, which the
 * handler needs to resolve the tenant's messaging connection. The handler bean
 * lives in miot-conversational (module dependency direction: conversational →
 * integrations), discovered CDI-wide by {@link ModulithJobWorker} like any
 * other handler.
 *
 * <p>The park hook ({@code JobFailureNotifyOnPark}) never matches notification
 * rules against this job type itself, so a parked notification can't notify
 * about its own failure in a loop.
 */
public final class JobFailureNotificationFeature {

    private JobFailureNotificationFeature() {
    }

    public static final String JOB_TYPE = "job_failure_notification";

    public static final String PAYLOAD_TENANT_CODE = "tenantCode";
    /** JSON array of E.164 recipient phone numbers. */
    public static final String PAYLOAD_RECIPIENTS = "recipients";
    public static final String PAYLOAD_FAILED_JOB_ID = "failedJobId";
    public static final String PAYLOAD_FAILED_JOB_TYPE = "failedJobType";
    public static final String PAYLOAD_CORRELATION_KEY = "correlationKey";
    /** The parked job's lastError, pre-truncated by the hook. */
    public static final String PAYLOAD_ERROR = "error";
    /** Optional pre-approved Meta template; absent = free-form text. */
    public static final String PAYLOAD_TEMPLATE_NAME = "templateName";
    public static final String PAYLOAD_LANGUAGE = "language";

    /** Budget for {@link #PAYLOAD_ERROR} in the payload and the message body. */
    public static final int ERROR_MAX_LENGTH = 300;
}
