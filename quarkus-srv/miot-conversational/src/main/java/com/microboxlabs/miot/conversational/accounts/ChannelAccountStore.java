package com.microboxlabs.miot.conversational.accounts;

import java.util.Map;

/** The mode each channel of a tenant is set to. A channel with no row is {@link ChannelMode#PLATFORM}. */
public interface ChannelAccountStore {

    /** By channel key; only the channels with a row. */
    Map<String, ChannelAccountsService.Setting> find(String tenantCode);

    ChannelAccountsService.Setting save(String tenantCode, String channel, ChannelMode mode, String updatedBy);
}
