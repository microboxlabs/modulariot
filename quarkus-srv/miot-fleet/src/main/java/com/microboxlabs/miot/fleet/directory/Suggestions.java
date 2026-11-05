package com.microboxlabs.miot.fleet.directory;

import com.microboxlabs.miot.fleet.directory.Views.SuggestionView;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/** Values the trips repeat often enough to propose for a truck's fields. */
final class Suggestions {

    static final String USUAL_TRAILER = "USUAL_TRAILER";
    static final String USUAL_DRIVER = "USUAL_DRIVER";

    private static final int MIN_TRIPS = 5;
    private static final double MIN_SHARE = 0.6;

    private Suggestions() {
    }

    static List<SuggestionView> of(AssetFacts facts, Profile profile, Set<String> dismissed) {
        List<SuggestionView> found = new ArrayList<>();
        if (AssetFields.kind(facts, profile) == AssetKind.TRUCK) {
            suggest(USUAL_TRAILER, AssetFields.USUAL_TRAILER, facts.trailer(), profile, dismissed)
                    .ifPresent(found::add);
            suggest(USUAL_DRIVER, AssetFields.USUAL_DRIVER, facts.driver(), profile, dismissed).ifPresent(found::add);
        }
        return found;
    }

    private static Optional<SuggestionView> suggest(String kind, String field, Share share, Profile profile,
            Set<String> dismissed) {
        if (share == null || share.count() < MIN_TRIPS || share.ratio() < MIN_SHARE
                || share.value().equalsIgnoreCase(Objects.toString(profile.fields().get(field), ""))
                || dismissed.contains(key(kind, share.value()))) {
            return Optional.empty();
        }
        return Optional.of(new SuggestionView(kind, field, share.value(), share.count(), share.total()));
    }

    /** How a dismissal is stored: {@code kind=value}. */
    static String key(String kind, String value) {
        return kind + "=" + value;
    }
}
