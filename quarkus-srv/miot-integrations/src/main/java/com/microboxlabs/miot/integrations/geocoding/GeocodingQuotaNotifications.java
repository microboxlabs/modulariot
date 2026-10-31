package com.microboxlabs.miot.integrations.geocoding;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.iam.NotificationRecipients;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Subscription;
import com.microboxlabs.miot.integrations.persistence.GeocodingPlanRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.YearMonth;
import java.util.Map;

@ApplicationScoped
public class GeocodingQuotaNotifications {

    private final NotificationRecipients recipients;
    private final GeocodingPlanRepository repository;
    private final ObjectMapper mapper;

    @Inject
    public GeocodingQuotaNotifications(NotificationRecipients recipients, GeocodingPlanRepository repository,
            ObjectMapper mapper) {
        this.recipients = recipients;
        this.repository = repository;
        this.mapper = mapper;
    }

    public boolean enqueue(String organization, YearMonth month, String level, long used, int quota,
            int pct, Plan plan, Subscription subscription) {
        if (repository.notificationClaimed(organization, month.atDay(1), level)) {
            return false;
        }
        var audience = recipients.organizationAdmins(organization);
        var notification = new GeocodingQuotaNotification(organization, audience.name(), audience.id(),
                audience.tenantCode(), month.toString(), level, used, quota, pct, subscription.onExhausted(),
                plan.enforced(), plan.overagePriceUsd(), "/app/es/users/settings/geocoding",
                recipients.platformOwners(), audience.emails(), plan.whatsAppRecipients(), subscription.whatsAppRecipients());
        Map<String, Object> payload = mapper.convertValue(notification, new TypeReference<>() {});
        return repository.claimNotification(organization, month.atDay(1), level, audience.tenantCode(),
                notification.idempotencyKey(), payload);
    }
}
