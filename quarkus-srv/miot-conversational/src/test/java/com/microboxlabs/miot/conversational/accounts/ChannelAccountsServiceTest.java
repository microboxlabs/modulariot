package com.microboxlabs.miot.conversational.accounts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import java.util.List;
import org.junit.jupiter.api.Test;

class ChannelAccountsServiceTest {

    private static final String TENANT = "tenant-a";

    private final InMemoryChannelAccounts accounts = new InMemoryChannelAccounts();
    private final ChannelAccountsService service = accounts.service;

    @Test
    void anOrganizationSendsFromThePlatformUntilItChoosesItsOwnAccount() {
        assertEquals(PlatformScope.TENANT, service.sendingTenant(TENANT, "whatsapp"));
        assertEquals(PlatformScope.TENANT, service.sendingTenant(TENANT, "email"));

        accounts.connect(TENANT, ProviderType.WHATSAPP);
        ChannelAccountsService.Account own = service.set(TENANT, "WhatsApp", ChannelMode.OWN, "owner@example.com");

        assertEquals(ChannelMode.OWN, own.mode());
        assertTrue(own.ownConnected());
        assertEquals("owner@example.com", own.updatedBy());
        assertEquals(TENANT, service.sendingTenant(TENANT, "whatsapp"));
        assertEquals(PlatformScope.TENANT, service.sendingTenant(TENANT, "email"));
    }

    @Test
    void theOwnAccountNeedsAnActiveConnection() {
        assertThrows(IllegalStateException.class, () -> service.set(TENANT, "email", ChannelMode.OWN, "o"));
        assertEquals(ChannelMode.PLATFORM, service.set(TENANT, "email", ChannelMode.PLATFORM, "o").mode());
    }

    @Test
    void listsBothChannelsWithTheirConnections() {
        accounts.connect(TENANT, ProviderType.RESEND).own(TENANT, "email");

        List<ChannelAccountsService.Account> list = service.list(TENANT);

        assertEquals(List.of("whatsapp", "email"), list.stream().map(ChannelAccountsService.Account::channel).toList());
        assertEquals(ChannelMode.PLATFORM, list.get(0).mode());
        assertFalse(list.get(0).ownConnected());
        assertEquals(ChannelMode.OWN, list.get(1).mode());
        assertTrue(list.get(1).ownConnected());
    }

    @Test
    void thePlatformAlwaysSendsFromItsOwnAccountsAndHasNoModes() {
        assertEquals(PlatformScope.TENANT, service.sendingTenant(PlatformScope.TENANT, "whatsapp"));
        assertThrows(IllegalArgumentException.class, () -> service.list(PlatformScope.TENANT));
        assertThrows(IllegalArgumentException.class,
                () -> service.set(PlatformScope.TENANT, "email", ChannelMode.PLATFORM, "o"));
    }

    @Test
    void refusesUnknownChannelsAndAMissingMode() {
        assertThrows(IllegalArgumentException.class, () -> service.set(TENANT, "slack", ChannelMode.OWN, "o"));
        assertThrows(IllegalArgumentException.class, () -> service.set(TENANT, "email", null, "o"));
        assertThrows(IllegalArgumentException.class, () -> service.sendingTenant(TENANT, "fax"));
    }
}
