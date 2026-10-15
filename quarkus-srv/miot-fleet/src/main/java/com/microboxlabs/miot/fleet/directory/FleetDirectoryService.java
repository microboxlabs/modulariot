package com.microboxlabs.miot.fleet.directory;

import com.microboxlabs.miot.fleet.directory.Views.AssetDetail;
import com.microboxlabs.miot.fleet.directory.Views.AssetPage;
import com.microboxlabs.miot.fleet.directory.Views.AssetRow;
import com.microboxlabs.miot.fleet.directory.Views.AssetUpdate;
import com.microboxlabs.miot.fleet.directory.Views.SuggestionView;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The fleet directory: what the integrations know about each asset, with what people set by hand on top. A
 * manual value wins until it is cleared; integrations then fill the field again.
 */
public class FleetDirectoryService {

    static final String USUAL_TRAILER = Suggestions.USUAL_TRAILER;
    static final String USUAL_DRIVER = Suggestions.USUAL_DRIVER;
    static final String MANUAL = "MANUAL";
    static final String SUGGESTION = "SUGGESTION";

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

    // ---- reads

    public AssetPage list(Viewer viewer, AssetQuery query) {
        Snapshot snapshot = snapshot(viewer);
        Map<String, Profile> stored = profiles.all(viewer.organizationId());
        Map<String, Set<String>> dismissed = profiles.dismissed(viewer.organizationId());
        LocalDate today = today();
        Instant endOfToday = today.plusDays(1).atStartOfDay(zone).toInstant();

        List<AssetRow> rows = snapshot.facts().values().stream()
                .map(facts -> row(facts,
                        stored.getOrDefault(facts.id(), Profile.empty(viewer.organizationId(), facts.id())),
                        dismissed.getOrDefault(facts.id(), Set.of()), snapshot, today))
                .toList();
        List<AssetRow> matching = rows.stream()
                .filter(r -> AssetFigures.matches(r, query, stored.get(r.id()), today))
                .sorted(AssetFigures.order(query.sort()))
                .toList();
        int from = (int) Math.min((long) query.page() * query.size(), matching.size());
        int to = Math.min(from + query.size(), matching.size());
        return new AssetPage(matching.subList(from, to), matching.size(), query.page(), query.size(),
                AssetFigures.summary(rows, stored, today, endOfToday), AssetFigures.kinds(rows),
                AssetFigures.carriers(rows));
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
        List<Change> changes = new ArrayList<>();

        Map<String, String> requestedFields = update.fields() == null ? Map.of() : update.fields();
        requestedFields.forEach((key, raw) -> {
            if (!AssetFields.editable(key)) {
                throw new IllegalArgumentException("Unknown field: " + key);
            }
            String value = AssetFields.normalize(key, raw);
            String old = current.fields().get(key);
            if (!Objects.equals(old, value)) {
                changes.add(new Change(key, old, value, MANUAL, actor, now));
            }
        });
        Map<String, String> requestedDocuments = update.documents() == null ? Map.of() : update.documents();
        requestedDocuments.forEach((key, raw) -> {
            if (!AssetFields.DOCUMENTS.contains(key)) {
                throw new IllegalArgumentException("Unknown document: " + key);
            }
            LocalDate value = AssetFields.date(raw);
            LocalDate old = current.documents().get(key);
            if (!Objects.equals(old, value)) {
                changes.add(new Change(Profile.DOCUMENT + key, AssetFields.text(old), AssetFields.text(value),
                        MANUAL, actor, now));
            }
        });
        Profile saved = changes.isEmpty() ? current
                : profiles.apply(viewer.organizationId(), assetId, changes);
        return detail(facts, saved, snapshot, dismissed(viewer, assetId));
    }

    /** Sets the suggested value on the field it belongs to. */
    public AssetDetail accept(Viewer viewer, String assetId, String kind, String actor) {
        Snapshot snapshot = snapshot(viewer);
        AssetFacts facts = visible(snapshot, assetId);
        Profile current = profiles.find(viewer.organizationId(), assetId)
                .orElse(Profile.empty(viewer.organizationId(), assetId));
        SuggestionView suggestion = suggestion(facts, current, dismissed(viewer, assetId), kind);
        String old = current.fields().get(suggestion.field());
        Profile saved = profiles.apply(viewer.organizationId(), assetId, List.of(
                new Change(suggestion.field(), old, suggestion.value(), SUGGESTION, actor, clock.instant())));
        return detail(facts, saved, snapshot, dismissed(viewer, assetId));
    }

    /** Hides the current suggestion of that kind; a different value is suggested again. */
    public AssetDetail dismiss(Viewer viewer, String assetId, String kind, String actor) {
        Snapshot snapshot = snapshot(viewer);
        AssetFacts facts = visible(snapshot, assetId);
        Profile current = profiles.find(viewer.organizationId(), assetId)
                .orElse(Profile.empty(viewer.organizationId(), assetId));
        SuggestionView suggestion = suggestion(facts, current, dismissed(viewer, assetId), kind);
        profiles.dismiss(viewer.organizationId(), assetId, Suggestions.key(suggestion.kind(), suggestion.value()),
                actor);
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
        Map<String, ActivityTotals> totals = activity.totals(facts.keySet(),
                today.minusDays(AssetFigures.PERIOD_DAYS - 1L), today);
        Double fleetUtilization = totals.isEmpty() ? null
                : totals.values().stream().mapToDouble(t -> 100.0 * t.activeDays() / AssetFigures.PERIOD_DAYS)
                        .average().orElse(0);
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

    private static SuggestionView suggestion(AssetFacts facts, Profile profile, Set<String> dismissed, String kind) {
        return Suggestions.of(facts, profile, dismissed).stream()
                .filter(s -> s.kind().equals(kind)).findFirst()
                .orElseThrow(() -> new NoSuchElementException("No suggestion " + kind + " for " + facts.id()));
    }

    private AssetRow row(AssetFacts facts, Profile profile, Set<String> dismissed, Snapshot snapshot,
            LocalDate today) {
        ActivityTotals totals = snapshot.totals().getOrDefault(facts.id(), ActivityTotals.NONE);
        return new AssetRow(facts.id(), profile.fields().get(AssetFields.LABEL), AssetFields.kind(facts, profile),
                AssetFields.status(facts, clock.instant()), AssetFields.carrier(facts, profile),
                AssetFields.driver(facts, profile), facts.currentTrip(), facts.nextTrip(),
                AssetFields.document("accreditation", profile, today), AssetFigures.round(totals.km()),
                facts.lastSignalAt(), facts.gpsProvider(), Suggestions.of(facts, profile, dismissed).size());
    }

    private AssetDetail detail(AssetFacts facts, Profile profile, Snapshot snapshot, Set<String> dismissed) {
        return new AssetDetail(facts.id(), profile.fields().get(AssetFields.LABEL), AssetFields.kind(facts, profile),
                AssetFields.status(facts, clock.instant()), AssetFields.views(facts, profile),
                AssetFields.live(facts, profile),
                AssetFigures.indicators(facts, snapshot.totals().get(facts.id()), snapshot.fleetUtilization()),
                facts.currentTrip(), data.plannedTrips(facts.id()), data.recentTrips(facts.id(), 10),
                AssetFields.documentViews(profile, today()), Suggestions.of(facts, profile, dismissed),
                profiles.changes(profile.organizationId(), facts.id(), 20));
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), zone);
    }

    /** Drops cached snapshots, so the next read goes back to the integrations. */
    public void refresh() {
        snapshots.clear();
    }
}
