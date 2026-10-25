package com.microboxlabs.miot.conversational.accounts;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** A {@link ChannelAccountsService} on a map, with the tenants' connections as {@code tenant/PROVIDER} keys. */
public final class InMemoryChannelAccounts implements ChannelAccountStore {

    public final Map<String, Map<String, ChannelAccountsService.Setting>> rows = new HashMap<>();
    public final Set<String> connections = new HashSet<>();
    public final ChannelAccountsService service =
            new ChannelAccountsService(this, (tenant, provider) -> connections.contains(key(tenant, provider)));

    public InMemoryChannelAccounts connect(String tenant, ProviderType provider) {
        connections.add(key(tenant, provider));
        return this;
    }

    public InMemoryChannelAccounts own(String tenant, String channel) {
        save(tenant, channel, ChannelMode.OWN, "test");
        return this;
    }

    @Override
    public Map<String, ChannelAccountsService.Setting> find(String tenantCode) {
        return new LinkedHashMap<>(rows.getOrDefault(tenantCode, Map.of()));
    }

    @Override
    public ChannelAccountsService.Setting save(String tenantCode, String channel, ChannelMode mode,
            String updatedBy) {
        ChannelAccountsService.Setting s = new ChannelAccountsService.Setting(mode, updatedBy, Instant.EPOCH);
        rows.computeIfAbsent(tenantCode, t -> new HashMap<>()).put(channel, s);
        return s;
    }

    private static String key(String tenant, ProviderType provider) {
        return tenant + "/" + provider;
    }
}
