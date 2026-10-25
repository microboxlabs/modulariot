package com.microboxlabs.miot.conversational.accounts;

import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.BiPredicate;

/**
 * Which account an organization's rules send WhatsApp and email from: the platform's, included for every
 * organization, or the organization's own connection. The platform itself always sends from its own accounts.
 */
@ApplicationScoped
public class ChannelAccountsService {

    public static final String WHATSAPP = "whatsapp";
    public static final String EMAIL = "email";
    private static final Map<String, ProviderType> PROVIDERS = Map.of(
            WHATSAPP, ProviderType.WHATSAPP, EMAIL, ProviderType.RESEND);
    private static final List<String> CHANNELS = List.of(WHATSAPP, EMAIL);

    /** A stored mode; {@code updatedBy} and {@code updatedAt} are null for the default. */
    public record Setting(ChannelMode mode, String updatedBy, Instant updatedAt) {
    }

    /** A channel of the organization: its mode, and whether it has an active own connection. */
    public record Account(String channel, ChannelMode mode, boolean ownConnected, String updatedBy,
            Instant updatedAt) {
    }

    private final ChannelAccountStore store;
    private final BiPredicate<String, ProviderType> connected;

    @Inject
    public ChannelAccountsService(ChannelAccountStore store, IntegrationConnectionRepository connections) {
        this(store, (tenant, provider) -> connections.findActiveByProvider(tenant, provider) != null);
    }

    /** {@code connected} tells whether a tenant has an active connection of a provider. */
    public ChannelAccountsService(ChannelAccountStore store, BiPredicate<String, ProviderType> connected) {
        this.store = store;
        this.connected = connected;
    }

    public ChannelMode mode(String tenantCode, String channel) {
        if (PlatformScope.TENANT.equals(tenantCode)) {
            return ChannelMode.OWN;
        }
        Setting setting = store.find(tenantCode).get(channel(channel));
        return setting == null ? ChannelMode.PLATFORM : setting.mode();
    }

    /** The tenant whose connection sends the channel for {@code tenantCode}. */
    public String sendingTenant(String tenantCode, String channel) {
        return mode(tenantCode, channel) == ChannelMode.OWN ? tenantCode : PlatformScope.TENANT;
    }

    public List<Account> list(String tenantCode) {
        if (PlatformScope.TENANT.equals(tenantCode)) {
            throw new IllegalArgumentException("The platform sends only from its own accounts");
        }
        Map<String, Setting> stored = store.find(tenantCode);
        return CHANNELS.stream().map(c -> account(tenantCode, c, stored.get(c))).toList();
    }

    /**
     * Sets the mode. {@link ChannelMode#OWN} needs an active connection of the channel's provider.
     *
     * @throws IllegalArgumentException for an unknown channel or mode, or the platform's own tenant
     * @throws IllegalStateException when OWN is asked for without a connection
     */
    public Account set(String tenantCode, String channel, ChannelMode mode, String updatedBy) {
        String key = channel(channel);
        if (PlatformScope.TENANT.equals(tenantCode)) {
            throw new IllegalArgumentException("The platform sends only from its own accounts");
        }
        if (mode == null) {
            throw new IllegalArgumentException("mode: PLATFORM or OWN");
        }
        if (mode == ChannelMode.OWN && !connected.test(tenantCode, PROVIDERS.get(key))) {
            throw new IllegalStateException("Connect the organization's " + key + " account first");
        }
        return account(tenantCode, key, store.save(tenantCode, key, mode, updatedBy));
    }

    private Account account(String tenantCode, String channel, Setting setting) {
        Setting s = setting == null ? new Setting(ChannelMode.PLATFORM, null, null) : setting;
        return new Account(channel, s.mode(), connected.test(tenantCode, PROVIDERS.get(channel)), s.updatedBy(),
                s.updatedAt());
    }

    private static String channel(String channel) {
        String key = channel == null ? "" : channel.trim().toLowerCase(Locale.ROOT);
        if (!PROVIDERS.containsKey(key)) {
            throw new IllegalArgumentException("channel: whatsapp or email");
        }
        return key;
    }
}
