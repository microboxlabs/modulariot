package com.microboxlabs.miot.fleet.directory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.fleet.directory.FleetDirectoryService.Viewer;
import com.microboxlabs.miot.fleet.directory.Views.AssetDetail;
import com.microboxlabs.miot.fleet.directory.Views.AssetPage;
import com.microboxlabs.miot.fleet.directory.Views.AssetUpdate;
import com.microboxlabs.miot.fleet.directory.Views.FieldView;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import org.junit.jupiter.api.Test;

class FleetDirectoryServiceTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-14T15:00:00Z"), ZoneOffset.UTC);
    private static final ZoneId ZONE = ZoneId.of("America/Santiago");
    private static final Viewer VIEWER = new Viewer("acme", Set.of("acme-client"));
    private static final String ACTOR = "ana@example.com";

    private final InMemoryProfileStore profiles = new InMemoryProfileStore();
    private final InMemoryActivityStore activity = new InMemoryActivityStore();
    private final FleetDirectoryService fleet = new FleetDirectoryService(new DemoFleetData(CLOCK::instant), profiles,
            activity, CLOCK, ZONE, Duration.ZERO);

    private static AssetQuery all() {
        return new AssetQuery(null, null, null, null, false, false, null, 0, 50);
    }

    private static FieldView field(AssetDetail detail, String key) {
        return detail.fields().stream().filter(f -> f.key().equals(key)).findFirst().orElseThrow();
    }

    private static AssetUpdate fields(Map<String, String> fields) {
        return new AssetUpdate(fields, Map.of());
    }

    @Test
    void summarizesTheWholeFleetBeforeFilters() {
        AssetPage page = fleet.list(VIEWER, new AssetQuery(null, AssetKind.TRAILER, null, null, false, false, null,
                0, 50));
        assertEquals(2, page.total());
        assertEquals(7, page.summary().assets());
        assertEquals(3, page.summary().inTrip());
        assertEquals(1, page.summary().noSignal());
        assertEquals(6, page.summary().withSignal());
        assertEquals(1, page.summary().plannedToday());
        assertEquals(2, page.summary().suggestions());
        assertEquals("TRUCK", page.kinds().get(0).value());
        assertEquals(4, page.kinds().get(0).count());
    }

    @Test
    void filtersByStatusSearchAndCarrier() {
        assertEquals(List.of("DEMO-TR4"), fleet.list(VIEWER, new AssetQuery(null, null, AssetStatus.NO_SIGNAL, null,
                false, false, null, 0, 50)).items().stream().map(Views.AssetRow::id).toList());
        assertEquals(List.of("DEMO-TR2"), fleet.list(VIEWER, new AssetQuery("pedro", null, null, null, false, false,
                null, 0, 50)).items().stream().map(Views.AssetRow::id).toList());
        assertEquals(3, fleet.list(VIEWER, new AssetQuery(null, null, null, DemoFleetData.PACIFICO, false, false,
                null, 0, 50)).total());
        AssetPage second = fleet.list(VIEWER, new AssetQuery(null, null, null, null, false, false, null, 1, 5));
        assertEquals(7, second.total());
        assertEquals(2, second.items().size());
    }

    @Test
    void fieldsComeFromIntegrationsUntilSomeoneSetsThem() {
        AssetDetail before = fleet.asset(VIEWER, "DEMO-TR1");
        FieldView carrier = field(before, "carrier");
        assertEquals(DemoFleetData.ANDES, carrier.value());
        assertEquals(FieldSource.TRIP, carrier.source());
        assertEquals(23, carrier.count());
        assertEquals("TRUCK", field(before, "kind").value());
        assertEquals("Truck", field(before, "kind").reported());

        AssetDetail edited = fleet.update(VIEWER, "DEMO-TR1", fields(Map.of("carrier", "Otra empresa",
                "brandModel", "Volvo FH 540")), ACTOR);
        FieldView manual = field(edited, "carrier");
        assertEquals("Otra empresa", manual.value());
        assertEquals(FieldSource.MANUAL, manual.source());
        assertTrue(manual.conflict());
        assertEquals(DemoFleetData.ANDES, manual.integrationValue());
        assertEquals(2, edited.changes().size());

        Map<String, String> clear = new HashMap<>();
        clear.put("carrier", null);
        AssetDetail cleared = fleet.update(VIEWER, "DEMO-TR1", fields(clear), ACTOR);
        assertEquals(DemoFleetData.ANDES, field(cleared, "carrier").value());
        assertEquals(FieldSource.TRIP, field(cleared, "carrier").source());
        assertEquals("Volvo FH 540", field(cleared, "brandModel").value());
        assertEquals(3, cleared.changes().size());
    }

    @Test
    void anUnchangedValueRecordsNoChange() {
        fleet.update(VIEWER, "DEMO-TR2", fields(Map.of("label", "Tracto 2")), ACTOR);
        AssetDetail again = fleet.update(VIEWER, "DEMO-TR2", fields(Map.of("label", " Tracto 2 ")), ACTOR);
        assertEquals(1, again.changes().size());
        assertEquals("Tracto 2", again.label());
    }

    @Test
    void rejectsUnknownFieldsAndBadValues() {
        assertThrows(IllegalArgumentException.class,
                () -> fleet.update(VIEWER, "DEMO-TR1", fields(Map.of("owner", "x")), ACTOR));
        assertThrows(IllegalArgumentException.class,
                () -> fleet.update(VIEWER, "DEMO-TR1", fields(Map.of("kind", "bus")), ACTOR));
        assertThrows(IllegalArgumentException.class,
                () -> fleet.update(VIEWER, "DEMO-TR1", fields(Map.of("year", "1800")), ACTOR));
        assertThrows(IllegalArgumentException.class, () -> fleet.update(VIEWER, "DEMO-TR1",
                new AssetUpdate(Map.of(), Map.of("insurance", "31/03/2027")), ACTOR));
        assertThrows(NoSuchElementException.class, () -> fleet.asset(VIEWER, "OTHER-ASSET"));
    }

    @Test
    void documentsAreDueWithinThirtyDays() {
        AssetDetail detail = fleet.update(VIEWER, "DEMO-TR3", new AssetUpdate(Map.of(),
                Map.of("accreditation", "2027-03-14", "technicalReview", "2026-11-01", "insurance", "2026-10-01")),
                ACTOR);
        Map<String, DocumentStatus> status = new HashMap<>();
        detail.documents().forEach(d -> status.put(d.key(), d.status()));
        assertEquals(DocumentStatus.VALID, status.get("accreditation"));
        assertEquals(DocumentStatus.EXPIRING, status.get("technicalReview"));
        assertEquals(DocumentStatus.EXPIRED, status.get("insurance"));
        assertEquals(DocumentStatus.MISSING, status.get("circulationPermit"));
        assertEquals(1, fleet.list(VIEWER, new AssetQuery(null, null, null, null, false, true, null, 0, 50)).total());
    }

    @Test
    void suggestionsCanBeAcceptedOrDismissed() {
        AssetDetail detail = fleet.asset(VIEWER, "DEMO-TR1");
        assertEquals(List.of(FleetDirectoryService.USUAL_TRAILER, FleetDirectoryService.USUAL_DRIVER),
                detail.suggestions().stream().map(Views.SuggestionView::kind).toList());

        AssetDetail accepted = fleet.accept(VIEWER, "DEMO-TR1", FleetDirectoryService.USUAL_TRAILER, ACTOR);
        assertEquals("DEMO-JX1", field(accepted, "usualTrailer").value());
        assertEquals(FleetDirectoryService.SUGGESTION, accepted.changes().get(0).origin());
        assertEquals(1, accepted.suggestions().size());

        AssetDetail dismissed = fleet.dismiss(VIEWER, "DEMO-TR1", FleetDirectoryService.USUAL_DRIVER, ACTOR);
        assertTrue(dismissed.suggestions().isEmpty());
        assertNull(field(dismissed, "usualDriver").value());
        assertThrows(NoSuchElementException.class,
                () -> fleet.accept(VIEWER, "DEMO-TR1", FleetDirectoryService.USUAL_DRIVER, ACTOR));
        assertEquals(1, fleet.list(VIEWER, all()).summary().suggestions());
    }

    @Test
    void trucksShowTheImageOfTheirMakeModelAndYear() {
        List<String> asked = new java.util.ArrayList<>();
        com.microboxlabs.miot.core.vehicle.VehicleImages images = (tenant, q) -> {
            asked.add(tenant + "|" + q.make() + "|" + q.model() + "|" + q.year());
            return java.util.Optional.of(new com.microboxlabs.miot.core.vehicle.VehicleImages.Image(
                    "https://cdn.example/volvo.webp", Instant.parse("2026-10-14T15:05:00Z")));
        };
        FleetDirectoryService withImages = new FleetDirectoryService(new DemoFleetData(CLOCK::instant), profiles,
                activity, images, CLOCK, ZONE, Duration.ZERO);
        Viewer viewer = new Viewer("acme", Set.of("acme-client"), "acme-tenant");

        assertNull(withImages.asset(viewer, "DEMO-TR1").image());
        AssetDetail truck = withImages.update(viewer, "DEMO-TR1", fields(Map.of("brandModel", "Volvo FH 540")),
                ACTOR);
        assertEquals("https://cdn.example/volvo.webp", truck.image().url());
        withImages.update(viewer, "DEMO-JX1", fields(Map.of("brandModel", "Randon SR")), ACTOR);
        assertNull(withImages.asset(viewer, "DEMO-JX1").image());
        assertEquals(List.of("acme-tenant|Volvo|FH 540|2022"), asked);
    }

    @Test
    void trailersGetNoSuggestions() {
        assertTrue(fleet.asset(VIEWER, "DEMO-JX1").suggestions().isEmpty());
        assertFalse(fleet.asset(VIEWER, "DEMO-TR3").fields().isEmpty());
    }

    @Test
    void activityFillsMissingDaysWithZeros() {
        new ActivityRollup(new DemoFleetData(CLOCK::instant), activity, CLOCK, ZONE, Duration.ofDays(3), 72).run();
        List<ActivityDay> days = fleet.activity(VIEWER, "DEMO-TR1", 14);
        assertEquals(14, days.size());
        assertEquals(CLOCK.instant().atZone(ZONE).toLocalDate(), days.get(13).day());
        assertEquals(0, days.get(0).engineSeconds());
        assertTrue(days.get(12).engineSeconds() > 0);

        AssetDetail detail = fleet.asset(VIEWER, "DEMO-TR1");
        assertTrue(detail.indicators().km30d() > 0);
        assertTrue(detail.indicators().engineHours30d() > 0);
        assertEquals(23, detail.indicators().trips30d());
    }
}
