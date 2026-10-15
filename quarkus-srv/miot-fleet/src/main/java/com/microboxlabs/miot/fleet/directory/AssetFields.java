package com.microboxlabs.miot.fleet.directory;

import com.microboxlabs.miot.fleet.directory.Views.DocumentView;
import com.microboxlabs.miot.fleet.directory.Views.FieldView;
import com.microboxlabs.miot.fleet.directory.Views.LiveView;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** An asset's fields: what the integrations report, what people set by hand, and how input is checked. */
final class AssetFields {

    static final List<String> DOCUMENTS = List.of("accreditation", "technicalReview", "circulationPermit",
            "insurance");

    static final String LABEL = "label";
    static final String USUAL_TRAILER = "usualTrailer";
    static final String USUAL_DRIVER = "usualDriver";

    static final String BRAND_MODEL = "brandModel";
    static final String YEAR = "year";

    private static final String KIND = "kind";
    private static final String CARRIER = "carrier";
    private static final int DUE_DAYS = 30;
    private static final Duration NO_SIGNAL = Duration.ofHours(24);
    private static final int MAX_VALUE = 200;

    private record Integration(String value, FieldSource source, String reported, Integer count, Integer total) {

        static final Integration NONE = new Integration(null, FieldSource.NONE, null, null, null);
    }

    /** The editable fields, in display order, with what the integrations say for each. */
    private static final Map<String, Function<AssetFacts, Integration>> FIELDS = fields();

    private AssetFields() {
    }

    private static Map<String, Function<AssetFacts, Integration>> fields() {
        Map<String, Function<AssetFacts, Integration>> f = new LinkedHashMap<>();
        f.put(LABEL, a -> Integration.NONE);
        f.put(KIND, a -> a.reportedType() == null ? Integration.NONE
                : new Integration(AssetKind.fromReported(a.reportedType()).name(), FieldSource.SIGNAL,
                        a.reportedType(), null, null));
        f.put(BRAND_MODEL, a -> Integration.NONE);
        f.put(YEAR, a -> a.year() == null ? Integration.NONE
                : new Integration(a.year().toString(), FieldSource.SIGNAL, null, null, null));
        f.put("vin", a -> Integration.NONE);
        f.put(CARRIER, a -> trips(a.carrier()));
        f.put("base", a -> trips(a.origin()));
        f.put(USUAL_TRAILER, a -> Integration.NONE);
        f.put(USUAL_DRIVER, a -> Integration.NONE);
        return f;
    }

    private static Integration trips(Share share) {
        return share == null ? Integration.NONE
                : new Integration(share.value(), FieldSource.TRIP, null, share.count(), share.total());
    }

    static boolean editable(String key) {
        return FIELDS.containsKey(key);
    }

    /** Every field of the asset, the editable ones first, then the GPS provider. */
    static List<FieldView> views(AssetFacts facts, Profile profile) {
        List<FieldView> views = new ArrayList<>();
        FIELDS.forEach((key, integration) -> views.add(view(key, integration.apply(facts), profile)));
        views.add(new FieldView("gpsProvider", facts.gpsProvider(),
                facts.gpsProvider() == null ? FieldSource.NONE : FieldSource.SIGNAL, facts.gpsProvider(),
                FieldSource.SIGNAL, facts.senderClientId(), null, null, false, false));
        return views;
    }

    private static FieldView view(String key, Integration integration, Profile profile) {
        String manual = profile.fields().get(key);
        if (manual != null) {
            boolean conflict = integration.value() != null && !integration.value().equalsIgnoreCase(manual);
            return new FieldView(key, manual, FieldSource.MANUAL, integration.value(), integration.source(),
                    integration.reported(), integration.count(), integration.total(), conflict, true);
        }
        return new FieldView(key, integration.value(), integration.source(), integration.value(),
                integration.source(), integration.reported(), integration.count(), integration.total(), false, true);
    }

    static LiveView live(AssetFacts facts, Profile profile) {
        return new LiveView(facts.lastSignalAt(), facts.lat(), facts.lon(), facts.speed(), facts.engineOn(),
                facts.gpsProvider(), driver(facts, profile));
    }

    static AssetKind kind(AssetFacts facts, Profile profile) {
        AssetKind manual = AssetKind.parse(profile.fields().get(KIND));
        return manual != null ? manual : AssetKind.fromReported(facts.reportedType());
    }

    static AssetStatus status(AssetFacts facts, Instant now) {
        if (facts.currentTrip() != null) {
            return AssetStatus.IN_TRIP;
        }
        if (facts.lastSignalAt() == null || facts.lastSignalAt().isBefore(now.minus(NO_SIGNAL))) {
            return AssetStatus.NO_SIGNAL;
        }
        return AssetStatus.AVAILABLE;
    }

    static String carrier(AssetFacts facts, Profile profile) {
        String manual = profile.fields().get(CARRIER);
        if (manual != null) {
            return manual;
        }
        if (facts.currentTrip() != null && facts.currentTrip().carrier() != null) {
            return facts.currentTrip().carrier();
        }
        return facts.carrier() == null ? null : facts.carrier().value();
    }

    static String driver(AssetFacts facts, Profile profile) {
        if (facts.currentTrip() != null && facts.currentTrip().driver() != null) {
            return facts.currentTrip().driver();
        }
        if (facts.signalDriver() != null) {
            return facts.signalDriver();
        }
        return profile.fields().get(USUAL_DRIVER);
    }

    static List<DocumentView> documentViews(Profile profile, LocalDate today) {
        return DOCUMENTS.stream().map(key -> document(key, profile, today)).toList();
    }

    static DocumentView document(String key, Profile profile, LocalDate today) {
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

    /** Whether a document is expired or expires within {@code DUE_DAYS}. */
    static boolean due(Profile profile, LocalDate today) {
        if (profile == null) {
            return false;
        }
        return DOCUMENTS.stream().map(key -> document(key, profile, today).status())
                .anyMatch(s -> s == DocumentStatus.EXPIRING || s == DocumentStatus.EXPIRED);
    }

    /** The value to store for a field, or null to clear it. */
    static String normalize(String key, String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        if (value.length() > MAX_VALUE) {
            throw new IllegalArgumentException("Value too long for " + key);
        }
        if (KIND.equals(key)) {
            AssetKind kind = AssetKind.parse(value);
            if (kind == null) {
                throw new IllegalArgumentException("Unknown kind: " + value);
            }
            return kind.name();
        }
        if (YEAR.equals(key)) {
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

    static LocalDate date(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Not a date (yyyy-mm-dd): " + raw);
        }
    }

    static String text(LocalDate date) {
        return date == null ? null : date.toString();
    }
}
