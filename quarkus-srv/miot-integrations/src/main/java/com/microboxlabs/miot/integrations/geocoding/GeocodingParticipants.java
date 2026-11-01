package com.microboxlabs.miot.integrations.geocoding;

import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.core.event.ContactDirectory;
import com.microboxlabs.miot.core.event.Participant;
import com.microboxlabs.miot.core.event.ParticipantResolver;
import com.microboxlabs.miot.core.iam.NotificationRecipients;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * The roles of a {@code geocoding.quota.*} event. {@value #PLATFORM_OWNERS} are the active platform owners, by
 * email. {@value #ORGANIZATION_ADMINS} are the active owners and admins of the event's organization, by email, and
 * on WhatsApp when the organization's contact book has a contact with the same email and a WhatsApp number.
 */
@ApplicationScoped
public class GeocodingParticipants implements ParticipantResolver {

    public static final String PLATFORM_OWNERS = "dueños de plataforma";
    public static final String ORGANIZATION_ADMINS = "administradores de la organización";
    private static final String EMAIL = "email";
    private static final String WHATSAPP = "whatsapp";

    private final Supplier<List<String>> owners;
    private final Function<String, NotificationRecipients.OrganizationAudience> admins;
    private final Function<String, List<ContactDirectory.Entry>> contacts;

    @Inject
    GeocodingParticipants(NotificationRecipients recipients, Instance<ContactDirectory> directories) {
        this(recipients::platformOwners, recipients::organizationAdmins,
                tenant -> directories.stream().flatMap(d -> d.active(tenant).stream()).toList());
    }

    public GeocodingParticipants(Supplier<List<String>> owners,
            Function<String, NotificationRecipients.OrganizationAudience> admins,
            Function<String, List<ContactDirectory.Entry>> contacts) {
        this.owners = owners;
        this.admins = admins;
        this.contacts = contacts;
    }

    @Override
    public boolean supports(String contextKind) {
        return GeocodingEventCatalog.CONTEXT_KIND.equals(contextKind);
    }

    @Override
    public List<String> roles(String tenantCode, String contextKind) {
        return List.of(PLATFORM_OWNERS, ORGANIZATION_ADMINS);
    }

    /** {@code contextKey} is the organization's slug. */
    @Override
    public List<Participant> resolve(String tenantCode, String contextKind, String contextKey, String role,
            Map<String, Object> eventData) {
        String wanted = role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
        if (PLATFORM_OWNERS.equals(wanted)) {
            return owners.get().stream().map(e -> new Participant(e, EMAIL, e, null, PLATFORM_OWNERS)).toList();
        }
        if (ORGANIZATION_ADMINS.equals(wanted) && contextKey != null) {
            return organizationAdmins(tenantCode, contextKey);
        }
        return List.of();
    }

    private List<Participant> organizationAdmins(String tenantCode, String organization) {
        NotificationRecipients.OrganizationAudience audience = admins.apply(organization);
        if (!PlatformScope.TENANT.equals(tenantCode)
                && (tenantCode == null || !tenantCode.equals(audience.tenantCode()))) {
            return List.of();
        }
        List<ContactDirectory.Entry> book = audience.tenantCode() == null ? List.of()
                : contacts.apply(audience.tenantCode());
        List<Participant> out = new ArrayList<>();
        for (String email : audience.emails()) {
            ContactDirectory.Entry contact = book.stream()
                    .filter(c -> c.email() != null && c.email().trim().equalsIgnoreCase(email))
                    .findFirst().orElse(null);
            String name = contact == null || contact.name() == null ? email : contact.name();
            out.add(new Participant(email, EMAIL, name, contact == null ? null : contact.id(), ORGANIZATION_ADMINS));
            if (contact != null && contact.whatsapp() != null && !contact.whatsapp().isBlank()) {
                out.add(new Participant(contact.whatsapp(), WHATSAPP, name, contact.id(), ORGANIZATION_ADMINS));
            }
        }
        return out;
    }
}
