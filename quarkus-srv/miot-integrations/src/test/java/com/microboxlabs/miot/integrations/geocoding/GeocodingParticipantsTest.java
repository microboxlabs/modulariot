package com.microboxlabs.miot.integrations.geocoding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.event.ContactDirectory;
import com.microboxlabs.miot.core.event.Participant;
import com.microboxlabs.miot.core.iam.NotificationRecipients.OrganizationAudience;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GeocodingParticipantsTest {

    private final GeocodingParticipants participants = new GeocodingParticipants(
            () -> List.of("owner@example.com"),
            slug -> new OrganizationAudience(1, slug, "Example Org", "tenant-1",
                    List.of("admin@example.com", "other@example.com")),
            tenant -> "tenant-1".equals(tenant)
                    ? List.of(new ContactDirectory.Entry("c1", "Ana Admin", "jefa", List.of(), null, null, null, true,
                            "ADMIN@example.com", "+15550000001"))
                    : List.of());

    @Test
    void supportsOnlyTheQuotaContextAndOffersBothRoles() {
        assertTrue(participants.supports(GeocodingEventCatalog.CONTEXT_KIND));
        assertFalse(participants.supports("symptom_case"));
        assertEquals(List.of(GeocodingParticipants.PLATFORM_OWNERS, GeocodingParticipants.ORGANIZATION_ADMINS),
                participants.roles("_platform", GeocodingEventCatalog.CONTEXT_KIND));
    }

    @Test
    void platformOwnersAreReachedByEmail() {
        assertEquals(List.of(new Participant("owner@example.com", "email", "owner@example.com", null,
                        GeocodingParticipants.PLATFORM_OWNERS)),
                participants.resolve("_platform", GeocodingEventCatalog.CONTEXT_KIND, "example-org",
                        " Dueños de plataforma ", Map.of()));
    }

    @Test
    void adminsGetEmailAndTheirContactsWhatsApp() {
        List<Participant> admins = participants.resolve("_platform", GeocodingEventCatalog.CONTEXT_KIND,
                "example-org", GeocodingParticipants.ORGANIZATION_ADMINS, Map.of());

        assertEquals(List.of(
                new Participant("admin@example.com", "email", "Ana Admin", "c1",
                        GeocodingParticipants.ORGANIZATION_ADMINS),
                new Participant("+15550000001", "whatsapp", "Ana Admin", "c1",
                        GeocodingParticipants.ORGANIZATION_ADMINS),
                new Participant("other@example.com", "email", "other@example.com", null,
                        GeocodingParticipants.ORGANIZATION_ADMINS)), admins);
    }

    @Test
    void anUnknownRoleOrNoOrganizationGivesNobody() {
        assertTrue(participants.resolve("t", GeocodingEventCatalog.CONTEXT_KIND, "example-org", "driver", Map.of())
                .isEmpty());
        assertTrue(participants.resolve("t", GeocodingEventCatalog.CONTEXT_KIND, null,
                GeocodingParticipants.ORGANIZATION_ADMINS, Map.of()).isEmpty());
    }
}
