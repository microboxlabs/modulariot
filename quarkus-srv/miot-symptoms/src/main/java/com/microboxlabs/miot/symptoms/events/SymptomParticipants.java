package com.microboxlabs.miot.symptoms.events;

import com.microboxlabs.miot.core.event.Participant;
import com.microboxlabs.miot.core.event.ParticipantResolver;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.store.ContactStore;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalLong;
import org.jboss.logging.Logger;

/**
 * The participants of a symptom case. {@code driver} is the driver of the case's trip, with the phone the trip
 * has for them ({@code trip_live.driver_contact_phone}). Any other role is the tenant's active
 * contacts whose role text matches, ignoring case, on WhatsApp (their WhatsApp number, else their phone).
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomParticipants implements ParticipantResolver {

    public static final String DRIVER = "driver";
    private static final String WHATSAPP = "whatsapp";
    private static final String TRIP = """
            SELECT driver_name, driver_contact_phone FROM miot_trips.trip_live
             WHERE tenant_code = $1 AND trip_id::text = $2 AND asset_id = $3
            """;
    private static final Logger LOG = Logger.getLogger(SymptomParticipants.class);

    /** The driver of a trip. */
    public record Driver(String name, String phone) {
    }

    @FunctionalInterface
    public interface Drivers {
        Optional<Driver> find(String tenantCode, String tripId, String assetId);
    }

    private final Drivers drivers;
    private final ContactStore contacts;
    private final EngineCaseStore cases;

    @Inject
    SymptomParticipants(Instance<Pool> pool, ContactStore contacts, EngineCaseStore cases) {
        this((tenant, trip, asset) -> readDriver(pool.get(), tenant, trip, asset), contacts, cases);
    }

    public SymptomParticipants(Drivers drivers, ContactStore contacts, EngineCaseStore cases) {
        this.drivers = drivers;
        this.contacts = contacts;
        this.cases = cases;
    }

    @Override
    public boolean supports(String contextKind) {
        return SymptomEventCatalog.CONTEXT_KIND.equals(contextKind);
    }

    /** {@code driver}, then the roles of the active contacts as written, without repeats ignoring case. */
    @Override
    public List<String> roles(String tenantCode, String contextKind) {
        Map<String, String> roles = new LinkedHashMap<>();
        roles.put(DRIVER, DRIVER);
        for (Contact c : contacts.list(tenantCode, true)) {
            if (c.role() != null && !c.role().isBlank()) {
                roles.putIfAbsent(c.role().trim().toLowerCase(Locale.ROOT), c.role().trim());
            }
        }
        return List.copyOf(roles.values());
    }

    @Override
    public List<Participant> resolve(String tenantCode, String contextKind, String contextKey, String role,
            Map<String, Object> eventData) {
        if (role == null || role.isBlank()) {
            return List.of();
        }
        if (DRIVER.equalsIgnoreCase(role.trim())) {
            return driver(tenantCode, contextKey);
        }
        String wanted = role.trim().toLowerCase(Locale.ROOT);
        List<Participant> out = new ArrayList<>();
        for (Contact c : contacts.list(tenantCode, true)) {
            if (c.role() == null || !c.role().trim().toLowerCase(Locale.ROOT).equals(wanted)) {
                continue;
            }
            String address = phone(c);
            if (address != null) {
                out.add(new Participant(address, WHATSAPP, c.name(), c.id(), role.trim()));
            }
        }
        return out;
    }

    /**
     * The driver of the trip of the tenant's case. The trip and asset come from the case, never from the event
     * data: a simulated event carries data an organization member typed.
     */
    private List<Participant> driver(String tenantCode, String contextKey) {
        Optional<EngineCase> c = engineCase(tenantCode, contextKey);
        String tripId = c.map(EngineCase::tripId).orElse(null);
        String assetId = c.map(EngineCase::assetId).orElse(null);
        if (tripId == null || assetId == null) {
            return List.of();
        }
        try {
            return drivers.find(tenantCode, tripId, assetId)
                    .filter(d -> e164(d.phone()) != null)
                    .map(d -> List.of(new Participant(e164(d.phone()), WHATSAPP, d.name(), null, DRIVER)))
                    .orElse(List.of());
        } catch (RuntimeException e) {
            LOG.debugf("Symptom case %s: driver unavailable (%s)", contextKey, e.getClass().getSimpleName());
            return List.of();
        }
    }

    private Optional<EngineCase> engineCase(String tenantCode, String contextKey) {
        try {
            OptionalLong id = EngineCase.caseId(Long.parseLong(contextKey));
            return id.isPresent() ? cases.find(tenantCode, id.getAsLong()) : Optional.empty();
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private static Optional<Driver> readDriver(Pool pool, String tenantCode, String tripId, String assetId) {
        var rows = pool.preparedQuery(TRIP).execute(Tuple.of(tenantCode, tripId, assetId))
                .await().atMost(Duration.ofSeconds(10)).iterator();
        if (!rows.hasNext()) {
            return Optional.empty();
        }
        Row r = rows.next();
        return Optional.of(new Driver(r.getString("driver_name"), r.getString("driver_contact_phone")));
    }

    private static String phone(Contact c) {
        ContactChannels ch = c.channels() == null ? ContactChannels.NONE : c.channels();
        if (ch.whatsapp() != null) {
            return e164(ch.whatsapp());
        }
        return e164(ch.phone() != null ? ch.phone() : c.phone());
    }

    /** Digits with a leading {@code +}; null when there are no digits. */
    static String e164(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("\\D", "");
        return digits.isEmpty() ? null : "+" + digits;
    }
}
