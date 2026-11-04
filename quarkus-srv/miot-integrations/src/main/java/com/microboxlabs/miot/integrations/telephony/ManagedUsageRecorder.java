package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.core.auth.PlatformScope;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.UUID;

/**
 * Records WhatsApp use through the platform's account in the telephony ledger: each business-initiated template
 * (from the message pool, when it was sent), and each WhatsApp call (from the {@code calls} webhook's
 * {@code terminate}, once calling is on). Recording the same message or call id twice keeps one row.
 */
@ApplicationScoped
public class ManagedUsageRecorder {

    private final TelephonyUsageStore usage;

    @Inject
    public ManagedUsageRecorder(TelephonyUsageStore usage) {
        this.usage = usage;
    }

    /** {@code sendingTenant}: whose WhatsApp account sent it; only the platform's is metered. */
    public void whatsAppTemplate(String tenantCode, String sendingTenant, String messageId, Instant sentAt) {
        if (!PlatformScope.TENANT.equals(sendingTenant) || PlatformScope.TENANT.equals(tenantCode)
                || messageId == null) {
            return;
        }
        usage.insert(new UsageRow(UUID.randomUUID().toString(), tenantCode, UsageRow.WHATSAPP_TEMPLATE, true, null,
                messageId, null, null, UsageRow.WHATSAPP_TEMPLATE, UsageRow.CONFIRMED, null, 0, 0, null, null,
                UsageRow.SOURCE_MESSAGE_POOL, sentAt, sentAt, sentAt));
    }

    public void whatsAppCall(String tenantCode, String sendingTenant, String callId, int seconds, Instant endedAt) {
        if (!PlatformScope.TENANT.equals(sendingTenant) || PlatformScope.TENANT.equals(tenantCode) || callId == null) {
            return;
        }
        Instant started = endedAt.minusSeconds(Math.max(0, seconds));
        usage.insert(new UsageRow(UUID.randomUUID().toString(), tenantCode, UsageRow.WHATSAPP_CALL, true, null,
                callId, null, null, UsageRow.WHATSAPP_CALL, UsageRow.CONFIRMED, started, seconds,
                UsageRow.billedMinutes(seconds), null, null, UsageRow.SOURCE_WEBHOOK, started, endedAt, endedAt));
    }
}
