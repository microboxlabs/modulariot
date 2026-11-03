package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.core.fleet.FleetResources.DriverDetails;
import com.microboxlabs.miot.core.trips.TripDrivers;
import com.microboxlabs.miot.core.trips.TripDrivers.Assigned;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.store.ContactStore;
import com.microboxlabs.miot.symptoms.store.ContactSyncStore;
import com.microboxlabs.miot.symptoms.store.DuplicateNationalIdException;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Copies the drivers each tenant assigned to a trip in the last {@code window} from fleet into the tenant's contact
 * book. The book wins: an existing contact (same national id) only gets its empty fields filled. A driver switched
 * off in fleet switches off only a contact this sync created. Each run reads the drivers assigned since the tenant's
 * watermark, then the synced drivers whose fleet row changed since it and still have an assignment in the window;
 * the first run reads the whole window. Concurrent contact edits cause the sync's update to be skipped.
 *
 * <p>One replica runs it at a time, under a transaction-scoped Postgres advisory lock. It does nothing without the fleet or trips
 * module.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class DriverContactSync {

    private static final Logger LOG = Logger.getLogger(DriverContactSync.class);
    static final String SOURCE = "fleet-driver";
    static final String ACTOR = "fleet-sync";
    static final String ROLE = "Conductor";
    static final String TAG = "conductor";
    static final String LOCK = "miot_symptoms.contact_sync:" + SOURCE;
    static final int BATCH = 200;
    private static final String CONCURRENT_EDIT = "concurrent-edit";
    /** Rows written just before a run started may commit after it; the next run reads them again. */
    static final Duration OVERLAP = Duration.ofMinutes(2);

    public record Settings(boolean enabled, Duration window, String countryCode) {
    }

    /** What one run did to one tenant's book. */
    static final class Counts {
        int created;
        int filled;
        int deactivated;
        int phonesDropped;
        final Map<String, Integer> skipped = new TreeMap<>();

        void skip(String reason) {
            skipped.merge(reason, 1, Integer::sum);
        }

        boolean retryNeeded() {
            return skipped.containsKey("error") || skipped.containsKey(CONCURRENT_EDIT);
        }

        int skippedTotal() {
            return skipped.values().stream().mapToInt(Integer::intValue).sum();
        }
    }

    private final Settings settings;
    private final ContactStore contacts;
    private final ContactSyncStore progress;
    private final AuditService audit;
    private final FleetResources fleet;
    private final TripDrivers trips;
    private final Clock clock;

    @Inject
    DriverContactSync(
            @ConfigProperty(name = "miot.symptoms.driver-sync.enabled", defaultValue = "true") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.driver-sync.window", defaultValue = "30d") Duration window,
            @ConfigProperty(name = "miot.symptoms.driver-sync.default-country-code", defaultValue = "56")
            String countryCode,
            ContactStore contacts, ContactSyncStore progress, AuditService audit, FleetResources fleet,
            TripDrivers trips) {
        this(new Settings(enabled, window, countryCode), contacts, progress, audit, fleet, trips, Clock.systemUTC());
    }

    public DriverContactSync(Settings settings, ContactStore contacts, ContactSyncStore progress, AuditService audit,
            FleetResources fleet, TripDrivers trips, Clock clock) {
        this.settings = settings;
        this.contacts = contacts;
        this.progress = progress;
        this.audit = audit;
        this.fleet = fleet;
        this.trips = trips;
        this.clock = clock;
    }

    boolean active() {
        return settings.enabled() && fleet.listsDrivers() && trips.listsDrivers();
    }

    @Scheduled(every = "${miot.symptoms.driver-sync.every:5m}", delayed = "1m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduled() {
        if (!active()) {
            return;
        }
        try {
            if (progress.exclusively(LOCK, this::run).isEmpty()) {
                LOG.debug("Driver contact sync skipped: another replica is running it");
            }
        } catch (RuntimeException e) {
            LOG.warnf("Driver contact sync failed: %s", e.getMessage());
        }
    }

    /** Syncs every tenant with a recent driver assignment or an earlier sync; a failed tenant keeps its watermark. */
    Map<String, Counts> run() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        OffsetDateTime floor = now.minus(settings.window());
        Set<String> tenants = new TreeSet<>(trips.tenantsAssigningDrivers(floor));
        tenants.addAll(progress.tenants(SOURCE));
        Map<String, Counts> done = new LinkedHashMap<>();
        for (String tenant : tenants) {
            try {
                Counts counts = syncTenant(tenant, floor);
                if (!counts.retryNeeded()) {
                    progress.save(tenant, SOURCE, now);
                }
                done.put(tenant, counts);
                LOG.infof("Driver contact sync %s: created=%d filled=%d deactivated=%d skipped=%d %s "
                        + "phones-dropped=%d", tenant, counts.created, counts.filled, counts.deactivated,
                        counts.skippedTotal(), counts.skipped, counts.phonesDropped);
            } catch (RuntimeException e) {
                LOG.warnf("Driver contact sync %s failed: %s", tenant, e.getMessage());
            }
        }
        return done;
    }

    private Counts syncTenant(String tenant, OffsetDateTime floor) {
        OffsetDateTime since = progress.syncedUntil(tenant, SOURCE)
                .map(w -> w.minus(OVERLAP))
                .filter(s -> s.isAfter(floor))
                .orElse(floor);
        Counts counts = new Counts();
        Set<UUID> seen = new HashSet<>();

        OffsetDateTime at = since;
        UUID afterId = null;
        List<Assigned> assigned;
        do {
            assigned = trips.driversAssignedSince(tenant, at, afterId, BATCH);
            List<UUID> ids = assigned.stream().map(Assigned::driverId).filter(seen::add).toList();
            List<DriverDetails> found = ids.isEmpty() ? List.of() : fleet.drivers(tenant, ids);
            for (int i = found.size(); i < ids.size(); i++) {
                counts.skip("not-in-fleet");
            }
            found.forEach(d -> apply(tenant, d, true, counts));
            if (!assigned.isEmpty()) {
                Assigned last = assigned.get(assigned.size() - 1);
                at = last.assignedAt();
                afterId = last.driverId();
            }
        } while (assigned.size() == BATCH);

        at = since;
        afterId = null;
        List<DriverDetails> changed;
        do {
            changed = fleet.driversChangedSince(tenant, at, afterId, BATCH);
            List<DriverDetails> unseen = changed.stream().filter(d -> seen.add(d.id())).toList();
            Set<UUID> recent = trips.recentlyAssignedDrivers(tenant, unseen.stream().map(DriverDetails::id).toList(),
                    floor);
            unseen.stream().filter(d -> recent.contains(d.id())).forEach(d -> apply(tenant, d, false, counts));
            if (!changed.isEmpty()) {
                DriverDetails last = changed.get(changed.size() - 1);
                at = last.updatedAt();
                afterId = last.id();
            }
        } while (changed.size() == BATCH);
        return counts;
    }

    /** {@code assigned} false: the driver only changed in fleet, so a missing contact is not created. */
    private void apply(String tenant, DriverDetails d, boolean assigned, Counts counts) {
        try {
            String nationalId = ContactService.normalizeNationalId(d.document());
            if (nationalId == null) {
                counts.skip("no-national-id");
                return;
            }
            String idType = nationalIdType(nationalId, d.carrierTaxId());
            if (idType == null) {
                counts.skip("invalid-national-id");
                return;
            }
            var existing = contacts.findByNationalId(tenant, nationalId);
            if (existing.isEmpty()) {
                if (assigned) {
                    create(tenant, d, nationalId, idType, counts);
                }
                return;
            }
            Contact current = existing.get();
            if (!assigned && !synced(current)) {
                return;
            }
            if (!d.active()) {
                deactivate(current, counts);
            } else {
                fill(current, d, counts);
            }
        } catch (DuplicateNationalIdException e) {
            counts.skip("duplicate");
        } catch (RuntimeException e) {
            counts.skip("error");
            LOG.debugf(e, "Driver contact sync %s: driver %s failed", tenant, d.id());
        }
    }

    private void create(String tenant, DriverDetails d, String nationalId, String idType, Counts counts) {
        if (!d.active()) {
            counts.skip("inactive");
            return;
        }
        String name = trimOrNull(d.fullName());
        if (name == null) {
            counts.skip("no-name");
            return;
        }
        String phone = phone(d.phone(), settings.countryCode());
        if (phone == null && trimOrNull(d.phone()) != null) {
            counts.phonesDropped++;
        }
        ContactChannels channels = phone == null ? ContactChannels.NONE
                : new ContactChannels(phone, phone, null, null, null);
        List<CallMethod> methods = phone == null ? List.of() : List.of(CallMethod.PHONE, CallMethod.WHATSAPP);
        String companyType = companyTaxIdType(d.carrierTaxId());
        Contact saved = contacts.insert(new Contact(null, tenant, name, ROLE, phone, methods, true, null, ACTOR,
                null, null, nationalId, idType, trimOrNull(d.carrierLegalName()), null, channels, List.of(TAG),
                null, false, companyType == null ? null : ContactService.normalizeNationalId(d.carrierTaxId()),
                companyType));
        audit.log(tenant, ACTOR, "contact.created", ContactService.ENTITY, saved.id(), null,
                ContactService.createdDetails(saved, ACTOR));
        counts.created++;
    }

    private void deactivate(Contact c, Counts counts) {
        if (!ACTOR.equals(c.createdBy()) || !c.active()) {
            return;
        }
        if (contacts.updateIfUnchanged(copy(c, c.role(), new PhoneFields(c.phone(), c.methods(), c.channels()), false,
                new CompanyFields(c.company(), c.companyRut(), c.companyTaxIdType()), c.tags()), c.updatedAt()).isEmpty()) {
            counts.skip(CONCURRENT_EDIT);
            return;
        }
        audit.log(c.tenantCode(), ACTOR, "contact.updated", ContactService.ENTITY, c.id(), null,
                Map.of("source", ACTOR, "active", false));
        counts.deactivated++;
    }

    /** Fills the contact's empty fields from the driver; a value a person set is never replaced. */
    private void fill(Contact c, DriverDetails d, Counts counts) {
        List<String> filled = new ArrayList<>();
        String role = c.role();
        if (blank(role)) {
            role = ROLE;
            filled.add("role");
        }
        PhoneFields phone = fillPhone(c, d, counts, filled);
        CompanyFields company = fillCompany(c, d, filled);
        List<String> tags = fillTags(c, filled);
        if (filled.isEmpty()) {
            return;
        }
        if (contacts.updateIfUnchanged(copy(c, role, phone, c.active(), company, tags), c.updatedAt()).isEmpty()) {
            counts.skip(CONCURRENT_EDIT);
            return;
        }
        audit.log(c.tenantCode(), ACTOR, "contact.updated", ContactService.ENTITY, c.id(), null,
                Map.of("source", ACTOR, "filled", List.copyOf(filled)));
        counts.filled++;
    }

    private record PhoneFields(String phone, List<CallMethod> methods, ContactChannels channels) {
    }

    private record CompanyFields(String name, String taxId, String taxIdType) {
    }

    private PhoneFields fillPhone(Contact c, DriverDetails d, Counts counts, List<String> filled) {
        ContactChannels ch = c.channels() == null ? ContactChannels.NONE : c.channels();
        List<CallMethod> methods = c.methods() == null ? List.of() : c.methods();
        PhoneFields current = new PhoneFields(c.phone(), methods, ch);
        if (c.phone() != null || ch.phone() != null || ch.whatsapp() != null) {
            return current;
        }
        String driverPhone = phone(d.phone(), settings.countryCode());
        if (driverPhone == null) {
            if (trimOrNull(d.phone()) != null) {
                counts.phonesDropped++;
            }
            return current;
        }
        List<CallMethod> more = new ArrayList<>(methods);
        for (CallMethod m : List.of(CallMethod.PHONE, CallMethod.WHATSAPP)) {
            if (!more.contains(m)) {
                more.add(m);
            }
        }
        filled.add("phone");
        return new PhoneFields(driverPhone, more,
                new ContactChannels(driverPhone, driverPhone, ch.meet(), ch.teams(), ch.email()));
    }

    private static CompanyFields fillCompany(Contact c, DriverDetails d, List<String> filled) {
        String carrier = trimOrNull(d.carrierLegalName());
        String company = c.company();
        if (blank(company) && carrier != null) {
            company = carrier;
            filled.add("company");
        }
        String companyRut = c.companyRut();
        String companyType = c.companyTaxIdType();
        String carrierType = companyTaxIdType(d.carrierTaxId());
        if (companyRut == null && carrierType != null && carrier != null && company != null
                && company.trim().equalsIgnoreCase(carrier)) {
            companyRut = ContactService.normalizeNationalId(d.carrierTaxId());
            companyType = carrierType;
            filled.add("companyRut");
        }
        return new CompanyFields(company, companyRut, companyType);
    }

    private static List<String> fillTags(Contact c, List<String> filled) {
        List<String> tags = c.tags() == null ? List.of() : c.tags();
        if (tags.stream().noneMatch(t -> t.trim().equalsIgnoreCase(TAG))) {
            List<String> more = new ArrayList<>(tags);
            more.add(TAG);
            tags = more;
            filled.add("tags");
        }
        return tags;
    }

    private static Contact copy(Contact c, String role, PhoneFields phone, boolean active, CompanyFields company,
            List<String> tags) {
        return new Contact(c.id(), c.tenantCode(), c.name(), role, phone.phone(), phone.methods(), active, c.notes(),
                c.createdBy(), c.createdAt(), null, c.nationalId(), c.nationalIdType(), company.name(), c.position(),
                phone.channels(), tags, c.memberUserId(), c.provisional(), company.taxId(), company.taxIdType());
    }

    /** A contact this sync made or tagged as a driver. */
    private static boolean synced(Contact c) {
        return ACTOR.equals(c.createdBy())
                || (c.tags() != null && c.tags().stream().anyMatch(t -> t.trim().equalsIgnoreCase(TAG)));
    }

    /** An 8-digit DNI for a Peruvian carrier, otherwise a RUT with a valid check digit. */
    static String nationalIdType(String normalized, String carrierTaxId) {
        if ("RUC".equals(companyTaxIdType(carrierTaxId)) && ContactService.isValidId("DNI", normalized)) {
            return "DNI";
        }
        if (ContactService.isValidRut(normalized)) {
            return Contact.DEFAULT_NATIONAL_ID_TYPE;
        }
        return null;
    }

    /** RUT or RUC when the carrier's tax id is a valid one, otherwise none. */
    static String companyTaxIdType(String taxId) {
        String id = ContactService.normalizeNationalId(taxId);
        if (id == null) {
            return null;
        }
        if (ContactService.isValidRut(id)) {
            return Contact.DEFAULT_NATIONAL_ID_TYPE;
        }
        return ContactService.isValidRuc(id) ? "RUC" : null;
    }

    /**
     * The fleet phone as E.164: a valid international number is kept; a national mobile ({@code 9XXXXXXXX}) or one
     * with the country code but no plus ({@code 569XXXXXXXX}) gets {@code +countryCode}. Anything else is null.
     */
    static String phone(String raw, String countryCode) {
        if (blank(raw)) {
            return null;
        }
        String compact = raw.replaceAll("[\\s\\-().]", "");
        String e164;
        if (compact.startsWith("+")) {
            e164 = compact;
        } else if (compact.matches("9\\d{8}")) {
            e164 = "+" + countryCode + compact;
        } else if (compact.startsWith(countryCode) && compact.substring(countryCode.length()).matches("9\\d{8}")) {
            e164 = "+" + compact;
        } else {
            return null;
        }
        try {
            return ContactService.normalizePhone(e164);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String trimOrNull(String value) {
        return blank(value) ? null : value.trim().replaceAll("\\s+", " ");
    }
}
