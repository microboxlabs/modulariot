package com.microboxlabs.miot.integrations.dto;

import java.util.List;

/**
 * Console upsert body for a job-failure notification rule. {@code jobType}
 * comes from the path; tenant from the org context. Omitted {@code channel}
 * defaults to whatsapp, omitted {@code enabled} to true, omitted
 * {@code throttleSeconds} to 300.
 */
public record NotificationRuleRequest(
        String channel,
        List<String> recipients,
        Boolean enabled,
        Integer throttleSeconds,
        String templateName,
        String language) {

    private static final int DEFAULT_THROTTLE_SECONDS = 300;

    public String channelOrDefault() {
        return channel == null || channel.isBlank()
                ? com.microboxlabs.miot.integrations.domain.JobNotificationRule.CHANNEL_WHATSAPP
                : channel;
    }

    public boolean enabledOrDefault() {
        return enabled == null || enabled;
    }

    public int throttleSecondsOrDefault() {
        return throttleSeconds == null ? DEFAULT_THROTTLE_SECONDS : throttleSeconds;
    }
}
