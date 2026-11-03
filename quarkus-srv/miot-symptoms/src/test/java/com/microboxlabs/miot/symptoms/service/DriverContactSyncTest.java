package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.fleet.FleetResources.DriverDetails;
import com.microboxlabs.miot.core.fleet.NoFleetResources;
import com.microboxlabs.miot.core.trips.TripDrivers;
import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.store.ContactSyncStore;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class DriverContactSyncTest {

    private static final String TENANT = "mintral";
    private static final Instant NOW = Instant.parse("2026-11-03T12:00:00Z");
    private static final OffsetDateTime T = OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC);

    private final InMemoryContactStore contacts = new InMemoryContactStore();
    private final InMemoryAuditStore auditStore = new InMemoryAuditStore();
    private final FakeProgress progress = new FakeProgress();
    private final FakeFleet fleet = new FakeFleet();
    private final FakeTrips trips = new FakeTrips();
    private Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private DriverContactSync sync() {
        return new DriverContactSync(new DriverContactSync.Settings(true, Duration.ofDays(30), "56"), contacts,
                progress, new AuditService(auditStore), fleet, trips, clock);
    }

    private DriverDetails driver(String rut, String name, String phone, boolean active) {
        return fleet.add(TENANT, new DriverDetails(UUID.randomUUID(), rut, name, phone, active,
                "Transportes Uno SpA", "76.111.222-8", T.minusDays(60)));
    }

    private Contact contact(String rut) {
        return contacts.findByNationalId(TENANT, ContactService.normalizeNationalId(rut)).orElseThrow();
    }

    private List<AuditEvent> audit() {
        return auditStore.list(TENANT, null, null, null, null, null, 100);
    }

    @Test
    void phonesBecomeE164WithTheDefaultCountryCode() {
        assertEquals("+56912345678", DriverContactSync.phone("912345678", "56"));
        assertEquals("+56912345678", DriverContactSync.phone("9 1234 5678", "56"));
        assertEquals("+56912345678", DriverContactSync.phone("56912345678", "56"));
        assertEquals("+56912345678", DriverContactSync.phone("+56 9 1234-5678", "56"));
        assertEquals("+51987654321", DriverContactSync.phone("987654321", "51"));
        assertEquals("+5491112345678", DriverContactSync.phone("+5491112345678", "56"));
        assertNull(DriverContactSync.phone("221234567", "56"), "a landline without code is not guessed");
        assertNull(DriverContactSync.phone("12345", "56"));
        assertNull(DriverContactSync.phone("+12", "56"));
        assertNull(DriverContactSync.phone(" ", "56"));
    }

    @Test
    void nationalIdTypesFollowTheContactBookRules() {
        assertEquals("RUT", DriverContactSync.nationalIdType("111111111", "76111222-8"));
        assertNull(DriverContactSync.nationalIdType("111111112", "76111222-8"), "wrong check digit");
        assertEquals("DNI", DriverContactSync.nationalIdType("45678912", "20100000009"));
        assertNull(DriverContactSync.nationalIdType("45678912", null));
        assertEquals("RUT", DriverContactSync.companyTaxIdType("76.111.222-8"));
        assertEquals("RUC", DriverContactSync.companyTaxIdType("20100000009"));
        assertNull(DriverContactSync.companyTaxIdType("76.111.222-0"));
    }

    @Test
    void anAssignedDriverMissingFromTheBookIsCreatedAsAConductor() {
        DriverDetails d = driver("11.111.111-1", "  Juan   Pérez ", "912345678", true);
        trips.assign(TENANT, d.id(), T.minusDays(2));

        var counts = sync().run().get(TENANT);

        Contact c = contact("11111111-1");
        assertEquals(1, counts.created);
        assertEquals("Juan Pérez", c.name());
        assertEquals("Conductor", c.role());
        assertEquals(List.of("conductor"), c.tags());
        assertEquals("Transportes Uno SpA", c.company());
        assertEquals("761112228", c.companyRut());
        assertEquals("RUT", c.companyTaxIdType());
        assertEquals("+56912345678", c.phone());
        assertEquals(new ContactChannels("+56912345678", "+56912345678", null, null, null), c.channels());
        assertEquals(List.of(CallMethod.PHONE, CallMethod.WHATSAPP), c.methods());
        assertEquals("fleet-sync", c.createdBy());
        assertTrue(c.active());
        AuditEvent created = audit().get(0);
        assertEquals("contact.created", created.action());
        assertEquals("fleet-sync", created.details().get("source"));
        assertEquals(T, progress.syncedUntil(TENANT, DriverContactSync.SOURCE).orElseThrow());
    }

    @Test
    void anInvalidPhoneStillCreatesTheContactWithoutOne() {
        DriverDetails d = driver("11.111.111-1", "Juan", "22 123 4567", true);
        trips.assign(TENANT, d.id(), T.minusDays(2));

        var counts = sync().run().get(TENANT);

        assertNull(contact("111111111").phone());
        assertEquals(List.of(), contact("111111111").methods());
        assertEquals(1, counts.phonesDropped);
    }

    @Test
    void theBookWinsAndOnlyEmptyFieldsAreFilled() {
        contacts.insert(new Contact(null, TENANT, "Juanito", "Chofer", "+56911111111",
                List.of(CallMethod.PHONE), true, null, "alice", null, null, "111111111", "RUT", null, null,
                new ContactChannels("+56911111111", null, null, null), List.of("vip"), null, false, null));
        DriverDetails d = driver("11.111.111-1", "Juan Pérez", "912345678", true);
        trips.assign(TENANT, d.id(), T.minusDays(2));

        var counts = sync().run().get(TENANT);

        Contact c = contact("111111111");
        assertEquals(1, counts.filled);
        assertEquals("Juanito", c.name());
        assertEquals("Chofer", c.role());
        assertEquals("+56911111111", c.phone(), "a phone a person set stays");
        assertNull(c.channels().whatsapp(), "and the channels with it");
        assertEquals("Transportes Uno SpA", c.company());
        assertEquals("761112228", c.companyRut());
        assertEquals(List.of("vip", "conductor"), c.tags());
        assertEquals("alice", c.createdBy());
        AuditEvent updated = audit().get(0);
        assertEquals("contact.updated", updated.action());
        assertEquals(List.of("company", "companyRut", "tags"), updated.details().get("filled"));

        progress.clear();
        assertEquals(0, sync().run().get(TENANT).filled, "nothing left to fill");
        assertEquals(1, audit().size(), "no audit when nothing changed");
    }

    @Test
    void aCompanyRutIsNotFilledUnderAnotherCompanysName() {
        contacts.insert(new Contact(null, TENANT, "Juan", null, null, List.of(), true, null, "alice", null, null,
                "111111111", "RUT", "Otra Empresa", null, ContactChannels.NONE, List.of(), null, false, null));
        DriverDetails d = driver("11.111.111-1", "Juan", "912345678", true);
        trips.assign(TENANT, d.id(), T.minusDays(2));

        sync().run();

        Contact c = contact("111111111");
        assertEquals("Otra Empresa", c.company());
        assertNull(c.companyRut());
        assertEquals("Conductor", c.role());
        assertEquals("+56912345678", c.phone(), "no number at all: the driver's is filled");
        assertEquals("+56912345678", c.channels().whatsapp());
    }

    @Test
    void anInactiveDriverSwitchesOffOnlyAContactTheSyncMade() {
        DriverDetails mine = driver("11.111.111-1", "Uno", "912345678", true);
        DriverDetails theirs = driver("22.222.222-2", "Dos", "912345679", true);
        contacts.insert(new Contact(null, TENANT, "Dos", "Conductor", null, List.of(), true, null, "alice", null,
                null, "222222222", "RUT", null, null, ContactChannels.NONE, List.of("conductor"), null, false));
        trips.assign(TENANT, mine.id(), T.minusDays(3));
        trips.assign(TENANT, theirs.id(), T.minusDays(3));
        sync().run();

        clock = Clock.fixed(NOW.plusSeconds(300), ZoneOffset.UTC);
        fleet.change(TENANT, mine.id(), false, T.plusSeconds(100));
        fleet.change(TENANT, theirs.id(), false, T.plusSeconds(100));
        var counts = sync().run().get(TENANT);

        assertEquals(1, counts.deactivated);
        assertFalse(contact("111111111").active());
        assertTrue(contact("222222222").active(), "a contact a person made is never switched off");
    }

    @Test
    void anInactiveDriverIsNotCreated() {
        DriverDetails d = driver("11.111.111-1", "Uno", null, false);
        trips.assign(TENANT, d.id(), T.minusDays(3));

        var counts = sync().run().get(TENANT);

        assertEquals(Map.of("inactive", 1), counts.skipped);
        assertTrue(contacts.findByNationalId(TENANT, "111111111").isEmpty());
    }

    @Test
    void aChangedDriverUpdatesOnlyContactsAlreadySynced() {
        DriverDetails synced = driver("11.111.111-1", "Uno", null, true);
        trips.assign(TENANT, synced.id(), T.minusDays(3));
        DriverDetails notAssigned = driver("22.222.222-2", "Dos", "912345678", true);
        contacts.insert(new Contact(null, TENANT, "Dos", null, null, List.of(), true, null, "alice", null, null,
                "222222222", "RUT", null, null, ContactChannels.NONE, List.of(), null, false));
        sync().run();
        assertNull(contact("111111111").phone());

        clock = Clock.fixed(NOW.plusSeconds(300), ZoneOffset.UTC);
        fleet.change(TENANT, synced.id(), true, T.plusSeconds(100), "912345678");
        fleet.change(TENANT, notAssigned.id(), true, T.plusSeconds(100), "912345678");
        DriverDetails stranger = fleet.add(TENANT, new DriverDetails(UUID.randomUUID(), "33.333.333-3", "Tres",
                null, true, null, null, T.plusSeconds(100)));
        sync().run();

        assertEquals("+56912345678", contact("111111111").phone());
        assertNull(contact("222222222").phone(), "a person's contact that was never synced is left alone");
        assertTrue(contacts.findByNationalId(TENANT, "333333333").isEmpty(),
                "a changed driver without a recent trip is not added: " + stranger.id());
    }

    @Test
    void theWatermarkLimitsTheNextRunAndTheWindowLimitsTheFirst() {
        DriverDetails old = driver("11.111.111-1", "Viejo", null, true);
        DriverDetails recent = driver("22.222.222-2", "Reciente", null, true);
        trips.assign(TENANT, old.id(), T.minusDays(31));
        trips.assign(TENANT, recent.id(), T.minusDays(29));

        sync().run();

        assertEquals(T.minusDays(30), trips.sinceAsked.get(0));
        assertTrue(contacts.findByNationalId(TENANT, "111111111").isEmpty(), "outside the window");
        assertTrue(contacts.findByNationalId(TENANT, "222222222").isPresent());

        clock = Clock.fixed(NOW.plusSeconds(300), ZoneOffset.UTC);
        trips.sinceAsked.clear();
        sync().run();
        assertEquals(T.minus(DriverContactSync.OVERLAP), trips.sinceAsked.get(0),
                "the next run starts at the watermark, less the overlap");
        assertEquals(T.plusSeconds(300), progress.syncedUntil(TENANT, DriverContactSync.SOURCE).orElseThrow());
    }

    @Test
    void manyDriversArePagedAndEachIsReadOnce() {
        for (int i = 0; i < DriverContactSync.BATCH * 2 + 5; i++) {
            DriverDetails d = fleet.add(TENANT, new DriverDetails(UUID.randomUUID(), rut(10_000_000 + i),
                    "Conductor " + i, null, true, null, null, T.minusDays(60)));
            trips.assign(TENANT, d.id(), T.minusDays(5).plusSeconds(i / 3));
        }

        var counts = sync().run().get(TENANT);

        assertEquals(DriverContactSync.BATCH * 2 + 5, counts.created);
        assertEquals(Map.of(), counts.skipped);
    }

    @Test
    void oneBadRowDoesNotStopTheBatchAndTenantsStayApart() {
        DriverDetails bad = driver("11.111.111-2", "Mal RUT", null, true);
        DriverDetails broken = driver("22.222.222-2", "Falla", null, true);
        DriverDetails good = driver("33.333.333-3", "Bien", null, true);
        DriverDetails noId = driver(" ", "Sin documento", null, true);
        DriverDetails other = fleet.add("other", new DriverDetails(UUID.randomUUID(), "44.444.444-4", "Otro", null,
                true, null, null, T.minusDays(60)));
        for (DriverDetails d : List.of(bad, broken, good, noId)) {
            trips.assign(TENANT, d.id(), T.minusDays(1));
        }
        trips.assign("other", other.id(), T.minusDays(1));
        trips.assign(TENANT, UUID.randomUUID(), T.minusDays(1));
        InMemoryContactStore failing = new InMemoryContactStore() {
            @Override
            public synchronized Contact insert(Contact c) {
                if ("222222222".equals(c.nationalId())) {
                    throw new IllegalStateException("database hiccup");
                }
                return super.insert(c);
            }
        };
        var result = new DriverContactSync(new DriverContactSync.Settings(true, Duration.ofDays(30), "56"),
                failing, progress, new AuditService(auditStore), fleet, trips, clock).run();

        var counts = result.get(TENANT);
        assertEquals(1, counts.created);
        assertEquals(Map.of("error", 1, "invalid-national-id", 1, "no-national-id", 1, "not-in-fleet", 1),
                counts.skipped);
        assertTrue(failing.findByNationalId(TENANT, "333333333").isPresent());
        assertTrue(failing.findByNationalId(TENANT, "444444444").isEmpty(), "another tenant's driver");
        assertTrue(failing.findByNationalId("other", "444444444").isPresent());
    }

    @Test
    void aFailingTenantKeepsItsWatermarkAndTheOthersGoOn() {
        DriverDetails d = fleet.add("other", new DriverDetails(UUID.randomUUID(), "44.444.444-4", "Otro", null,
                true, null, null, T.minusDays(60)));
        trips.assign("other", d.id(), T.minusDays(1));
        trips.assign(TENANT, UUID.randomUUID(), T.minusDays(1));
        fleet.failFor = TENANT;

        var result = sync().run();

        assertFalse(result.containsKey(TENANT));
        assertTrue(progress.syncedUntil(TENANT, DriverContactSync.SOURCE).isEmpty());
        assertTrue(contacts.findByNationalId("other", "444444444").isPresent());
    }

    @Test
    void concurrentEditsSkipFillingAndDeactivationWithoutAuditingAChange() {
        for (boolean active : List.of(true, false)) {
            fleet.byTenant.clear();
            trips.latest.clear();
            progress.clear();
            InMemoryContactStore racing = new InMemoryContactStore() {
                @Override
                public synchronized Optional<Contact> updateIfUnchanged(Contact c, OffsetDateTime expected) {
                    Contact current = find(c.tenantCode(), c.id()).orElseThrow();
                    super.update(new Contact(current.id(), current.tenantCode(), "Edited by Alice", "Dispatcher",
                            "+56999999999", List.of(CallMethod.PHONE), true, "Keep this note", current.createdBy(),
                            current.createdAt(), current.updatedAt(), current.nationalId(), current.nationalIdType(),
                            "Alice's company", null, ContactChannels.NONE, List.of("vip"), null, false));
                    return super.updateIfUnchanged(c, expected);
                }
            };
            racing.insert(new Contact(null, TENANT, "Juan", null, null, List.of(), true, null, "fleet-sync", null,
                    null, "111111111", "RUT", null, null, ContactChannels.NONE, List.of(), null, false));
            DriverDetails d = driver("11.111.111-1", "Juan", "912345678", active);
            trips.assign(TENANT, d.id(), T.minusDays(1));
            var job = new DriverContactSync(new DriverContactSync.Settings(true, Duration.ofDays(30), "56"), racing,
                    progress, new AuditService(auditStore), fleet, trips, clock);

            var counts = job.run().get(TENANT);

            Contact saved = racing.findByNationalId(TENANT, "111111111").orElseThrow();
            assertEquals("Edited by Alice", saved.name());
            assertEquals("Dispatcher", saved.role());
            assertEquals("+56999999999", saved.phone());
            assertEquals("Alice's company", saved.company());
            assertEquals(List.of("vip"), saved.tags());
            assertTrue(saved.active());
            assertEquals(0, counts.filled);
            assertEquals(0, counts.deactivated);
            assertEquals(1, counts.skipped.get("concurrent-edit"));
            assertTrue(audit().isEmpty());
        }
    }

    @Test
    void fleetChangesLeaveContactsWithoutATripInTheWindowAlone() {
        DriverDetails d = driver("11.111.111-1", "Juan", null, true);
        trips.assign(TENANT, d.id(), T.minusDays(29));
        sync().run();
        clock = Clock.fixed(NOW.plus(Duration.ofDays(2)), ZoneOffset.UTC);
        fleet.change(TENANT, d.id(), false, T.plusDays(1));

        var counts = sync().run().get(TENANT);

        assertTrue(contact("111111111").active(), "an assignment outside the rolling window is no longer eligible");
        assertEquals(0, counts.deactivated);
    }

    @Test
    void aManuallyTaggedContactWithoutATripIsNotSynced() {
        DriverDetails d = driver("11.111.111-1", "Juan", "912345678", true);
        contacts.insert(new Contact(null, TENANT, "Juan", null, null, List.of(), true, null, "alice", null, null,
                "111111111", "RUT", null, null, ContactChannels.NONE, List.of("conductor"), null, false));
        progress.save(TENANT, DriverContactSync.SOURCE, T.minusMinutes(5));
        fleet.change(TENANT, d.id(), true, T.minusMinutes(1));

        sync().run();

        assertNull(contact("111111111").phone());
        assertTrue(audit().isEmpty());
    }

    @Test
    void withoutFleetOrTripsTheJobDoesNothing() {
        var settings = new DriverContactSync.Settings(true, Duration.ofDays(30), "56");
        assertFalse(new DriverContactSync(settings, contacts, progress, new AuditService(auditStore),
                new NoFleetResources(), trips, clock).active());
        assertFalse(new DriverContactSync(settings, contacts, progress, new AuditService(auditStore), fleet,
                new TripDrivers() {
                }, clock).active());
        assertFalse(new DriverContactSync(new DriverContactSync.Settings(false, Duration.ofDays(30), "56"),
                contacts, progress, new AuditService(auditStore), fleet, trips, clock).active());
        assertTrue(sync().active());
    }

    private static String rut(int n) {
        int sum = 0;
        int factor = 2;
        for (int x = n; x > 0; x /= 10) {
            sum += (x % 10) * factor;
            factor = factor == 7 ? 2 : factor + 1;
        }
        int rest = 11 - sum % 11;
        return n + "-" + (rest == 11 ? "0" : rest == 10 ? "K" : Integer.toString(rest));
    }

    private static final class FakeProgress implements ContactSyncStore {
        private final Map<String, OffsetDateTime> marks = new HashMap<>();

        @Override
        public Optional<OffsetDateTime> syncedUntil(String tenantCode, String source) {
            return Optional.ofNullable(marks.get(tenantCode + "|" + source));
        }

        @Override
        public void save(String tenantCode, String source, OffsetDateTime syncedUntil) {
            marks.put(tenantCode + "|" + source, syncedUntil);
        }

        @Override
        public List<String> tenants(String source) {
            return marks.keySet().stream().filter(k -> k.endsWith("|" + source))
                    .map(k -> k.substring(0, k.indexOf('|'))).toList();
        }

        @Override
        public <T> Optional<T> exclusively(String name, Supplier<T> work) {
            return Optional.ofNullable(work.get());
        }

        void clear() {
            marks.clear();
        }
    }

    private static final class FakeFleet extends NoFleetResources {
        private final Map<String, Map<UUID, DriverDetails>> byTenant = new HashMap<>();
        String failFor;

        DriverDetails add(String tenant, DriverDetails d) {
            byTenant.computeIfAbsent(tenant, t -> new LinkedHashMap<>()).put(d.id(), d);
            return d;
        }

        void change(String tenant, UUID id, boolean active, OffsetDateTime at) {
            DriverDetails d = byTenant.get(tenant).get(id);
            change(tenant, id, active, at, d.phone());
        }

        void change(String tenant, UUID id, boolean active, OffsetDateTime at, String phone) {
            DriverDetails d = byTenant.get(tenant).get(id);
            add(tenant, new DriverDetails(id, d.document(), d.fullName(), phone, active, d.carrierLegalName(),
                    d.carrierTaxId(), at));
        }

        @Override
        public boolean listsDrivers() {
            return true;
        }

        @Override
        public List<DriverDetails> drivers(String tenantCode, Collection<UUID> ids) {
            if (tenantCode.equals(failFor)) {
                throw new IllegalStateException("fleet is down");
            }
            Map<UUID, DriverDetails> all = byTenant.getOrDefault(tenantCode, Map.of());
            return ids.stream().map(all::get).filter(d -> d != null).toList();
        }

        @Override
        public List<DriverDetails> driversChangedSince(String tenantCode, OffsetDateTime since, UUID afterId,
                int limit) {
            return byTenant.getOrDefault(tenantCode, Map.of()).values().stream()
                    .filter(d -> afterId == null ? d.updatedAt().isAfter(since)
                            : d.updatedAt().isAfter(since)
                                    || (d.updatedAt().isEqual(since) && d.id().compareTo(afterId) > 0))
                    .sorted(Comparator.comparing(DriverDetails::updatedAt).thenComparing(DriverDetails::id))
                    .limit(limit).toList();
        }
    }

    private static final class FakeTrips implements TripDrivers {
        private final Map<String, Map<UUID, OffsetDateTime>> latest = new HashMap<>();
        final List<OffsetDateTime> sinceAsked = new ArrayList<>();

        void assign(String tenant, UUID driver, OffsetDateTime at) {
            latest.computeIfAbsent(tenant, t -> new HashMap<>()).merge(driver, at,
                    (a, b) -> a.isAfter(b) ? a : b);
        }

        @Override
        public boolean listsDrivers() {
            return true;
        }

        @Override
        public List<String> tenantsAssigningDrivers(OffsetDateTime since) {
            return latest.entrySet().stream()
                    .filter(e -> e.getValue().values().stream().anyMatch(t -> t.isAfter(since)))
                    .map(Map.Entry::getKey).toList();
        }

        @Override
        public Set<UUID> recentlyAssignedDrivers(String tenantCode, Collection<UUID> ids, OffsetDateTime since) {
            var assignments = latest.getOrDefault(tenantCode, Map.of());
            return ids.stream().filter(id -> assignments.containsKey(id) && assignments.get(id).isAfter(since))
                    .collect(Collectors.toSet());
        }

        @Override
        public List<Assigned> driversAssignedSince(String tenantCode, OffsetDateTime since, UUID afterId,
                int limit) {
            if (afterId == null) {
                sinceAsked.add(since);
            }
            return latest.getOrDefault(tenantCode, Map.of()).entrySet().stream()
                    .map(e -> new Assigned(e.getKey(), e.getValue()))
                    .filter(a -> afterId == null ? a.assignedAt().isAfter(since)
                            : a.assignedAt().isAfter(since)
                                    || (a.assignedAt().isEqual(since) && a.driverId().compareTo(afterId) > 0))
                    .sorted(Comparator.comparing(Assigned::assignedAt).thenComparing(Assigned::driverId))
                    .limit(limit).toList();
        }
    }
}
