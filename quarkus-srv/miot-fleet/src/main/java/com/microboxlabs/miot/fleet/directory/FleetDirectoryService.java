package com.microboxlabs.miot.fleet.directory;

import com.microboxlabs.miot.fleet.directory.Views.AssetDetail;
import com.microboxlabs.miot.fleet.directory.Views.AssetPage;
import com.microboxlabs.miot.fleet.directory.Views.AssetRow;
import com.microboxlabs.miot.fleet.directory.Views.AssetUpdate;
import com.microboxlabs.miot.fleet.directory.Views.DocumentView;
import com.microboxlabs.miot.fleet.directory.Views.Facet;
import com.microboxlabs.miot.fleet.directory.Views.FieldView;
import com.microboxlabs.miot.fleet.directory.Views.Indicators;
import com.microboxlabs.miot.fleet.directory.Views.LiveView;
import com.microboxlabs.miot.fleet.directory.Views.SuggestionView;
import com.microboxlabs.miot.fleet.directory.Views.Summary;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/**
 * The fleet directory: what the integrations know about each asset, with what people set by hand on top. A
 * manual value wins until it is cleared; integrations then fill the field again.
 */
public class FleetDirectoryService {

    public static final List<String> DOCUMENTS = List.of("accreditation", "technicalReview", "circulationPermit",
            "insurance");

    static final String USUAL_TRAILER = "USUAL_TRAILER";
    static final String USUAL_DRIVER = "USUAL_DRIVER";
    static final String MANUAL = "MANUAL";
    static final String SUGGESTION = "SUGGESTION";

    private static final int PERIOD_DAYS = 30;
    private static final int SUGGESTION_MIN_TRIPS = 5;
    private static final double SUGGESTION_MIN_SHARE = 0.6;
    private static final int DUE_DAYS = 30;
    private static final Duration NO_SIGNAL = Duration.ofHours(24);
    private static final int MAX_VALUE = 200;

    /** The editable fields, in display order, with what the integrations say for each. */
    private static final Map<String, Function<AssetFacts, Integration>> FIELDS = fields();

    private final FleetData data;
    private final ProfileStore profiles;
    private final ActivityStore activity;
    private final Clock clock;
    private final ZoneId zone;
    private final Duration cacheTtl;
    private final Map<String, Snapshot> snapshots = new ConcurrentHashMap<>();

    /** Who reads: the organization and the GPS clients whose assets it sees. */
    public record Viewer(String organizationId, Set<String> clientIds) {
    }

    private record Integration(String value, FieldSource source, String reported, Integer count, Integer total) {

        static final Integration NONE = new Integration(null, FieldSource.NONE, null, null, null);
    }

    private record Snapshot(Instant at, Map<String, AssetFacts> facts, Map<String, ActivityTotals> totals,
            Double fleetUtilization) {
    }

    public FleetDirectoryService(FleetData data, ProfileStore profiles, ActivityStore activity, Clock clock,
            ZoneId zone, Duration cacheTtl) {
        this.data = data;
        this.profiles = profiles;
        this.activity = activity;
        this.clock = clock;
        this.zone = zone;
        this.cacheTtl = cacheTtl;
    }

    private static Map<String, Function<AssetFacts, Integration>> fields() {
        Map<String, Function<AssetFacts, Integration>> f = new LinkedHashMap<>();
        f.put("label", a -> Integration.NONE);
        f.put("kind", a -> a.reportedType() == null ? Integration.NONE
                : new Integration(AssetKind.fromReported(a.reportedType()).name(), FieldSource.SIGNAL,
                        a.reportedType(), null, null));
        f.put("brandModel", a -> Integration.NONE);
        f.put("year", a -> a.year() == null ? Integration.NONE
                : new Integration(a.year().toString(), FieldSource.SIGNAL, null, null, null));
        f.put("vin", a -> Integration.NONE);
        f.put("carrier", a -> trips(a.carrier()));
        f.put("base", a -> trips(a.origin()));
        f.put("usualTrailer", a -> Integration.NONE);
        f.put("usualDriver", a -> Integration.NONE);
        return f;
    }

    private static Integration trips(Share share) {
        return share == null ? Integration.NONE
                : new Integration(share.value(), FieldSource.TRIP, null, share.count(), share.total());
    }

    // ---- reads

    public AssetPage list(Viewer viewer, AssetQuery query) {
        Snapshot snapshot = snapshot(viewer);
        Map<String, Profile> stored = profiles.all(viewer.organizationId());
        Map<String, Set<String>> dismissed = profiles.dismissed(viewer.organizationId());
        LocalDate today = today();
        Instant endOfToday = today.plusDays(1).atStartOfDay(zone).toInstant();

        List<AssetRow> rows = new ArrayList<>();
        for (AssetFacts facts : snapshot.facts().values()) {
            Profile profile = stored.getOrDefault(facts.id(), Profile.empty(viewer.organizationId(), facts.id()));
            rows.add(row(facts, profile, dismissed.getOrDefault(facts.id(), Set.of()), snapshot, today));
        }

        int withSignal = 0;
        int inTrip = 0;
        int plannedToday = 0;
        int noSignal = 0;
        int documentsDue = 0;
        int suggestions = 0;
        Map<String, Integer> kinds = new TreeMap<>();
        Map<String, Integer> carriers = new TreeMap<>();
        for (AssetRow r : rows) {
            if (r.status() == AssetStatus.NO_SIGNAL) {
                noSignal++;
            } else {
                withSignal++;
            }
            if (r.status() == AssetStatus.IN_TRIP) {
                inTrip++;
            }
            if (r.nextTrip() != null && r.nextTrip().start() != null && r.nextTrip().start().isBefore(endOfToday)) {
                plannedToday++;
            }
            if (due(stored.get(r.id()), today)) {
                documentsDue++;
            }
            if (r.suggestions() > 0) {
                suggestions++;
            }
            kinds.merge(r.kind().name(), 1, Integer::sum);
            if (r.carrier() != null) {
                carriers.merge(r.carrier(), 1, Integer::sum);
            }
        }
        Summary summary = new Summary(rows.size(), withSignal, inTrip, plannedToday, noSignal, documentsDue,
                suggestions);

        List<AssetRow> matching = rows.stream()
                .filter(r -> matches(r, query, stored.get(r.id()), today))
                .sorted(order(query.sort()))
                .toList();
        int from = Math.min(query.page() * query.size(), matching.size());
        int to = Math.min(from + query.size(), matching.size());
        return new AssetPage(matching.subList(from, to), matching.size(), query.page(), query.size(), summary,
                facets(kinds), facets(carriers));
    }

    public AssetDetail asset(Viewer viewer, String assetId) {
        Snapshot snapshot = snapshot(viewer);
        AssetFacts facts = visible(snapshot, assetId);
        Profile profile = profiles.find(viewer.organizationId(), assetId)
                .orElse(Profile.empty(viewer.organizationId(), assetId));
        return detail(facts, profile, snapshot, dismissed(viewer, assetId));
    }

    /** Daily activity for the last {@code days} days, today included; days without signals are zero. */
    public List<ActivityDay> activity(Viewer viewer, String assetId, int days) {
        visible(snapshot(viewer), assetId);
        int span = Math.clamp(days, 1, 60);
        LocalDate to = today();
        LocalDate from = to.minusDays(span - 1L);
        Map<LocalDate, ActivityDay> found = new HashMap<>();
        activity.days(assetId, from, to).forEach(d -> found.put(d.day(), d));
        List<ActivityDay> all = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            all.add(found.getOrDefault(d, new ActivityDay(d, 0, 0, 0, 0, 0)));
        }
        return all;
    }

    // ---- writes

    public AssetDetail update(Viewer viewer, String assetId, AssetUpdate update, String actor) {
        Snapshot snapshot = snapshot(viewer);
        AssetFacts facts = visible(snapshot, assetId);
        Profile current = profiles.find(viewer.organizationId(), assetId)
                .orElse(Profile.empty(viewer.organizationId(), assetId));
        Instant now = clock.instant();
        Map<String, String> fields = new LinkedHashMap<>(current.fields());
        Map<String, LocalDate> documents = new LinkedHashMap<>(current.documents());
        List<Change> changes = new ArrayList<>();

        Map<String, String> requestedFields = update.fields() == null ? Map.of() : update.fields();
        requestedFields.forEach((key, raw) -> {
            if (!FIELDS.containsKey(key)) {
                throw new IllegalArgumentException("Unknown field: " + key);
            }
            String value = normalize(key, raw);
            String old = fields.get(key);
            if (!Objects.equals(old, value)) {
                if (value == null) {
                    fields.remove(key);
                } else {
                    fields.put(key, value);
                }
                changes.add(new Change(key, old, value, MANUAL, actor, now));
            }
        });
        Map<String, String> requestedDocuments = update.documents() == null ? Map.of() : update.documents();
        requestedDocuments.forEach((key, raw) -> {
            if (!DOCUMENTS.contains(key)) {
                throw new IllegalArgumentException("Unknown document: " + key);
            }
            LocalDate value = date(raw);
            LocalDate old = documents.get(key);
            if (!Objects.equals(old, value)) {
                if (value == null) {
                    documents.remove(key);
                } else {
                    documents.put(key, value);
                }
                changes.add(new Change("document." + key, text(old), text(value), MANUAL, actor, now));
            }
        });
        Profile saved = changes.isEmpty() ? current
                : profiles.save(new Profile(viewer.organizationId(), assetId, fields, documents, actor, now), changes);
        return detail(facts, saved, snapshot, dismissed(viewer, assetId));
    }

    /** Sets the suggested value on the field it belongs to. */
    public AssetDetail accept(Viewer viewer, String assetId, String kind, String actor) {
        Snapshot snapshot = snapshot(viewer);
        AssetFacts facts = visible(snapshot, assetId);
        Profile current = profiles.find(viewer.organizationId(), assetId)
                .orElse(Profile.empty(viewer.organizationId(), assetId));
        SuggestionView suggestion = suggestions(facts, current, dismissed(viewer, assetId)).stream()
                .filter(s -> s.kind().equals(kind)).findFirst()
                .orElseThrow(() -> new NoSuchElementException("No suggestion " + kind + " for " + assetId));
        Instant now = clock.instant();
        Map<String, String> fields = new LinkedHashMap<>(current.fields());
        String old = fields.put(suggestion.field(), suggestion.value());
        Profile saved = profiles.save(new Profile(viewer.organizationId(), assetId, fields, current.documents(),
                actor, now), List.of(new Change(suggestion.field(), old, suggestion.value(), SUGGESTION, actor, now)));
        return detail(facts, saved, snapshot, dismissed(viewer, assetId));
    }

    /** Hides the current suggestion of that kind; a different value is suggested again. */
    public AssetDetail dismiss(Viewer viewer, String assetId, String kind, String actor) {
        Snapshot snapshot = snapshot(viewer);
        AssetFacts facts = visible(snapshot, assetId);
        Profile current = profiles.find(viewer.organizationId(), assetId)
                .orElse(Profile.empty(viewer.organizationId(), assetId));
        SuggestionView suggestion = suggestions(facts, current, dismissed(viewer, assetId)).stream()
                .filter(s -> s.kind().equals(kind)).findFirst()
                .orElseThrow(() -> new NoSuchElementException("No suggestion " + kind + " for " + assetId));
        profiles.dismiss(viewer.organizationId(), assetId, key(suggestion.kind(), suggestion.value()), actor);
        return detail(facts, current, snapshot, dismissed(viewer, assetId));
    }

    // ---- building blocks

    private Snapshot snapshot(Viewer viewer) {
        String key = String.join(",", new TreeSet<>(viewer.clientIds()));
        Instant now = clock.instant();
        Snapshot cached = snapshots.get(key);
        if (cached != null && cached.at().plus(cacheTtl).isAfter(now)) {
            return cached;
        }
        Map<String, AssetFacts> facts = new LinkedHashMap<>();
        data.assets(viewer.clientIds()).forEach(f -> facts.put(f.id(), f));
        LocalDate today = today();
        Map<String, ActivityTotals> totals = activity.totals(facts.keySet(), today.minusDays(PERIOD_DAYS - 1L),
                today);
        Double fleetUtilization = totals.isEmpty() ? null
                : totals.values().stream().mapToDouble(t -> 100.0 * t.activeDays() / PERIOD_DAYS).average()
                        .orElse(0);
        Snapshot fresh = new Snapshot(now, facts, totals, fleetUtilization);
        snapshots.put(key, fresh);
        return fresh;
    }

    private static AssetFacts visible(Snapshot snapshot, String assetId) {
        AssetFacts facts = snapshot.facts().get(assetId);
        if (facts == null) {
            throw new NoSuchElementException("Asset not found: " + assetId);
        }
        return facts;
    }

    private Set<String> dismissed(Viewer viewer, String assetId) {
        return profiles.dismissed(viewer.organizationId()).getOrDefault(assetId, Set.of());
    }

    private AssetRow row(AssetFacts facts, Profile profile, Set<String> dismissed, Snapshot snapshot,
            LocalDate today) {
        ActivityTotals totals = snapshot.totals().getOrDefault(facts.id(), ActivityTotals.NONE);
        return new AssetRow(facts.id(), profile.fields().get("label"), kind(facts, profile), status(facts),
                carrier(facts, profile), driver(facts, profile), facts.currentTrip(), facts.nextTrip(),
                document("accreditation", profile, today), round(totals.km()), facts.lastSignalAt(),
                facts.gpsProvider(), suggestions(facts, profile, dismissed).size());
    }

    private AssetDetail detail(AssetFacts facts, Profile profile, Snapshot snapshot, Set<String> dismissed) {
        LocalDate today = today();
        List<FieldView> fields = new ArrayList<>();
        FIELDS.forEach((key, integration) -> fields.add(field(key, integration.apply(facts), profile)));
        fields.add(new FieldView("gpsProvider", facts.gpsProvider(),
                facts.gpsProvider() == null ? FieldSource.NONE : FieldSource.SIGNAL, facts.gpsProvider(),
                FieldSource.SIGNAL, facts.senderClientId(), null, null, false, false));

        ActivityTotals totals = snapshot.totals().getOrDefault(facts.id(), ActivityTotals.NONE);
        Indicators indicators = new Indicators(round(totals.km()), round(totals.engineSeconds() / 3600.0),
                totals.engineSeconds() == 0 ? null : round(100.0 * totals.idleSeconds() / totals.engineSeconds()),
                snapshot.totals().containsKey(facts.id()) ? round(100.0 * totals.activeDays() / PERIOD_DAYS) : null,
                snapshot.fleetUtilization() == null ? null : round(snapshot.fleetUtilization()), facts.trips30d(),
                facts.trips30d() == 0 ? null : round(facts.tripHours30d() / facts.trips30d()));

        List<DocumentView> documents = DOCUMENTS.stream().map(key -> document(key, profile, today)).toList();
        LiveView live = new LiveView(facts.lastSignalAt(), facts.lat(), facts.lon(), facts.speed(), facts.engineOn(),
                facts.gpsProvider(), driver(facts, profile));
        return new AssetDetail(facts.id(), profile.fields().get("label"), kind(facts, profile), status(facts), fields,
                live, indicators, facts.currentTrip(), data.plannedTrips(facts.id()),
                data.recentTrips(facts.id(), 10), documents, suggestions(facts, profile, dismissed),
                profiles.changes(profile.organizationId(), facts.id(), 20));
    }

    private static FieldView field(String key, Integration integration, Profile profile) {
        String manual = profile.fields().get(key);
        if (manual != null) {
            boolean conflict = integration.value() != null && !integration.value().equalsIgnoreCase(manual);
            return new FieldView(key, manual, FieldSource.MANUAL, integration.value(), integration.source(),
                    integration.reported(), integration.count(), integration.total(), conflict, true);
        }
        return new FieldView(key, integration.value(), integration.source(), integration.value(),
                integration.source(), integration.reported(), integration.count(), integration.total(), false, true);
    }

    private List<SuggestionView> suggestions(AssetFacts facts, Profile profile, Set<String> dismissed) {
        List<SuggestionView> found = new ArrayList<>();
        if (kind(facts, profile) == AssetKind.TRUCK) {
            suggest(USUAL_TRAILER, "usualTrailer", facts.trailer(), profile, dismissed).ifPresent(found::add);
            suggest(USUAL_DRIVER, "usualDriver", facts.driver(), profile, dismissed).ifPresent(found::add);
        }
        return found;
    }

    private static Optional<SuggestionView> suggest(String kind, String field, Share share, Profile profile,
            Set<String> dismissed) {
        if (share == null || share.count() < SUGGESTION_MIN_TRIPS || share.ratio() < SUGGESTION_MIN_SHARE
                || share.value().equalsIgnoreCase(Objects.toString(profile.fields().get(field), ""))
                || dismissed.contains(key(kind, share.value()))) {
            return Optional.empty();
        }
        return Optional.of(new SuggestionView(kind, field, share.value(), share.count(), share.total()));
    }

    private static String key(String kind, String value) {
        return kind + "=" + value;
    }

    private static AssetKind kind(AssetFacts facts, Profile profile) {
        AssetKind manual = AssetKind.parse(profile.fields().get("kind"));
        return manual != null ? manual : AssetKind.fromReported(facts.reportedType());
    }

    private AssetStatus status(AssetFacts facts) {
        if (facts.currentTrip() != null) {
            return AssetStatus.IN_TRIP;
        }
        if (facts.lastSignalAt() == null || facts.lastSignalAt().isBefore(clock.instant().minus(NO_SIGNAL))) {
            return AssetStatus.NO_SIGNAL;
        }
        return AssetStatus.AVAILABLE;
    }

    private static String carrier(AssetFacts facts, Profile profile) {
        String manual = profile.fields().get("carrier");
        if (manual != null) {
            return manual;
        }
        if (facts.currentTrip() != null && facts.currentTrip().carrier() != null) {
            return facts.currentTrip().carrier();
        }
        return facts.carrier() == null ? null : facts.carrier().value();
    }

    private static String driver(AssetFacts facts, Profile profile) {
        if (facts.currentTrip() != null && facts.currentTrip().driver() != null) {
            return facts.currentTrip().driver();
        }
        if (facts.signalDriver() != null) {
            return facts.signalDriver();
        }
        return profile.fields().get("usualDriver");
    }

    private static DocumentView document(String key, Profile profile, LocalDate today) {
        LocalDate expires = profile.documents().get(key);
        DocumentStatus status;
        if (expires == null) {
            status = DocumentStatus.MISSING;
        } else if (expires.isBefore(today)) {
            status = DocumentStatus.EXPIRED;
        } else if (!expires.isAfter(today.plusDays(DUE_DAYS))) {
            status = DocumentStatus.EXPIRING;
        } else {
            status = DocumentStatus.VALID;
        }
        return new DocumentView(key, expires, status);
    }

    private static boolean due(Profile profile, LocalDate today) {
        if (profile == null) {
            return false;
        }
        return DOCUMENTS.stream().map(key -> document(key, profile, today).status())
                .anyMatch(s -> s == DocumentStatus.EXPIRING || s == DocumentStatus.EXPIRED);
    }

    private static boolean matches(AssetRow r, AssetQuery q, Profile profile, LocalDate today) {
        if (q.kind() != null && r.kind() != q.kind()) {
            return false;
        }
        if (q.status() != null && r.status() != q.status()) {
            return false;
        }
        if (q.carrier() != null && !q.carrier().equalsIgnoreCase(Objects.toString(r.carrier(), ""))) {
            return false;
        }
        if (q.withSuggestions() && r.suggestions() == 0) {
            return false;
        }
        if (q.documentsDue() && !due(profile, today)) {
            return false;
        }
        if (q.q() == null || q.q().isBlank()) {
            return true;
        }
        String needle = q.q().trim().toLowerCase(Locale.ROOT);
        return contains(r.id(), needle) || contains(r.label(), needle) || contains(r.driver(), needle)
                || contains(r.carrier(), needle);
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static Comparator<AssetRow> order(String sort) {
        if ("signal".equals(sort)) {
            return Comparator.comparing(AssetRow::lastSignalAt, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(AssetRow::id);
        }
        if ("km".equals(sort)) {
            return Comparator.comparingDouble(AssetRow::km30d).reversed().thenComparing(AssetRow::id);
        }
        return Comparator.comparing(AssetRow::id);
    }

    private static List<Facet> facets(Map<String, Integer> counts) {
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .map(e -> new Facet(e.getKey(), e.getValue())).toList();
    }

    private static String normalize(String key, String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        if (value.length() > MAX_VALUE) {
            throw new IllegalArgumentException("Value too long for " + key);
        }
        if ("kind".equals(key)) {
            AssetKind kind = AssetKind.parse(value);
            if (kind == null) {
                throw new IllegalArgumentException("Unknown kind: " + value);
            }
            return kind.name();
        }
        if ("year".equals(key)) {
            try {
                int year = Integer.parseInt(value);
                if (year < 1950 || year > 2100) {
                    throw new IllegalArgumentException("Year out of range: " + value);
                }
                return Integer.toString(year);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Year is not a number: " + value);
            }
        }
        return value;
    }

    private static LocalDate date(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Not a date (yyyy-mm-dd): " + raw);
        }
    }

    private static String text(LocalDate date) {
        return date == null ? null : date.toString();
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), zone);
    }

    private static double round(double value) {
        return Math.round(value * 10) / 10.0;
    }

    /** Drops cached snapshots, so the next read goes back to the integrations. */
    public void refresh() {
        snapshots.clear();
    }
}
