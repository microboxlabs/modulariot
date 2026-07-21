package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.integrations.jobs.JobFailureNotificationFeature;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jboss.logging.Logger;

/**
 * {@link ModulithJobHandler} for {@code job_failure_notification}: messages a
 * notification rule's recipients on WhatsApp that one of the tenant's async
 * jobs parked as FAILED. Lives in miot-conversational because the module
 * dependency direction (conversational → integrations) means integrations code
 * cannot inject {@link WhatsAppMessagingService}; the worker discovers handler
 * beans CDI-wide, so registration is automatic.
 *
 * <p>With a {@code templateName} in the payload the send uses that pre-approved
 * Meta template (named params {@code job_type}/{@code correlation_key}/{@code
 * error}); otherwise a free-form text, which Meta only delivers inside an open
 * 24h session window — fine for ops numbers that talk to the bot.
 *
 * <p>Per-recipient outcomes: {@code send} never throws on a Meta failure (it
 * persists a FAILED {@code wa_message} row), so each returned status is
 * checked. Every recipient failed ⇒ throw (the ledger retries with backoff);
 * partial ⇒ SUCCEEDED with the failures in the detail, because a retry would
 * re-message the recipients that already got it.
 *
 * <p>Deliberately no {@code serviceCode} on the send: it would graft the ops
 * recipient's message onto the service's driver conversation thread. These
 * notifications ride plain per-phone threads.
 */
@ApplicationScoped
public class JobFailureNotificationHandler implements ModulithJobHandler {

    private static final Logger LOG = Logger.getLogger(JobFailureNotificationHandler.class);
    private static final String ACTOR = "job-failure-notifier";
    private static final String TYPE_TEXT = "TEXT";
    private static final String TYPE_TEMPLATE = "TEMPLATE";
    private static final String PARAM_FALLBACK = "-";

    private final WhatsAppMessagingService messagingService;

    @Inject
    JobFailureNotificationHandler(WhatsAppMessagingService messagingService) {
        this.messagingService = messagingService;
    }

    @Override
    public String jobType() {
        return JobFailureNotificationFeature.JOB_TYPE;
    }

    @Override
    public JobOutcome handle(Map<String, Object> payload) {
        String tenantCode = str(payload.get(JobFailureNotificationFeature.PAYLOAD_TENANT_CODE));
        List<String> recipients = recipients(payload.get(JobFailureNotificationFeature.PAYLOAD_RECIPIENTS));
        if (tenantCode == null) {
            throw new IllegalArgumentException("job_failure_notification payload missing tenantCode");
        }
        if (recipients.isEmpty()) {
            throw new IllegalArgumentException("job_failure_notification payload has no recipients");
        }
        String failedJobType = str(payload.get(JobFailureNotificationFeature.PAYLOAD_FAILED_JOB_TYPE));
        String correlationKey = str(payload.get(JobFailureNotificationFeature.PAYLOAD_CORRELATION_KEY));
        String error = str(payload.get(JobFailureNotificationFeature.PAYLOAD_ERROR));
        String templateName = str(payload.get(JobFailureNotificationFeature.PAYLOAD_TEMPLATE_NAME));
        String language = str(payload.get(JobFailureNotificationFeature.PAYLOAD_LANGUAGE));

        int sent = 0;
        List<String> failures = new ArrayList<>();
        for (String recipient : recipients) {
            String failure = sendTo(tenantCode, recipient,
                    templateName, language, failedJobType, correlationKey, error);
            if (failure == null) {
                sent++;
            } else {
                failures.add(failure);
            }
        }
        if (sent == 0) {
            throw new IllegalStateException("WhatsApp notification failed for all "
                    + recipients.size() + " recipient(s): " + String.join("; ", failures));
        }
        String detail = "Notified " + sent + "/" + recipients.size() + " recipient(s) about "
                + failedJobType + (correlationKey != null ? " " + correlationKey : "")
                + (failures.isEmpty() ? "" : " — failed: " + String.join("; ", failures));
        return JobOutcome.succeeded(detail);
    }

    /** @return null when delivered to Meta, else a masked-recipient failure description */
    private String sendTo(String tenantCode, String recipient, String templateName, String language,
            String failedJobType, String correlationKey, String error) {
        try {
            Message result = messagingService.send(tenantCode,
                    request(recipient, templateName, language, failedJobType, correlationKey, error), ACTOR);
            if (result.status() == MessageStatus.FAILED) {
                return maskPhone(recipient) + ": " + result.errorMessage();
            }
            return null;
        } catch (Exception e) {
            LOG.warnf("Failure notification to %s (tenant %s) errored: %s",
                    maskPhone(recipient), tenantCode, e.getMessage());
            return maskPhone(recipient) + ": " + e.getMessage();
        }
    }

    private static SendWhatsAppMessageRequest request(String recipient, String templateName, String language,
            String failedJobType, String correlationKey, String error) {
        if (templateName != null) {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("job_type", orFallback(failedJobType));
            params.put("correlation_key", orFallback(correlationKey));
            params.put("error", orFallback(error));
            return new SendWhatsAppMessageRequest(recipient, TYPE_TEMPLATE, null,
                    templateName, language, params, null, null, null, null, null, null);
        }
        return new SendWhatsAppMessageRequest(recipient, TYPE_TEXT,
                body(failedJobType, correlationKey, error),
                null, null, null, null, null, null, null, null, null);
    }

    private static String body(String failedJobType, String correlationKey, String error) {
        StringBuilder body = new StringBuilder("⚠️ MIOT: el trabajo de integración '")
                .append(orFallback(failedJobType)).append("' quedó en error");
        if (correlationKey != null) {
            body.append(" (").append(correlationKey).append(")");
        }
        if (error != null) {
            body.append(". Detalle: ").append(error);
        }
        return body.append(". Revisa la consola de trabajos para reintentarlo.").toString();
    }

    private static String orFallback(String value) {
        return value == null || value.isBlank() ? PARAM_FALLBACK : value;
    }

    private static List<String> recipients(Object value) {
        if (!(value instanceof Iterable<?> iterable)) {
            return List.of();
        }
        List<String> recipients = new ArrayList<>();
        for (Object item : iterable) {
            String recipient = str(item);
            if (recipient != null) {
                recipients.add(recipient);
            }
        }
        return recipients;
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value);
        return s.isBlank() ? null : s;
    }

    /** Masks a phone for logs/details, keeping only the last 4 digits (PII reduction). */
    private static String maskPhone(String phone) {
        if (phone == null || phone.length() <= 4) {
            return "****";
        }
        return "****" + phone.substring(phone.length() - 4);
    }
}
