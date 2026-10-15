package com.microboxlabs.miot.fleet.directory;

import com.microboxlabs.miot.core.vehicle.VehicleImages;
import com.microboxlabs.miot.fleet.directory.Views.ImageView;
import java.util.Optional;

/** Studio images of trucks, from the make and model people set ("Volvo FH 540": make Volvo, model FH 540). */
final class AssetImages {

    static final AssetImages NONE = new AssetImages((tenantCode, query) -> Optional.empty());

    private static final int WIDTH = 800;

    private final VehicleImages images;

    AssetImages(VehicleImages images) {
        this.images = images;
    }

    /** Null for other kinds, without a make, or when no provider has one. */
    ImageView find(String tenantCode, AssetFacts facts, Profile profile) {
        if (AssetFields.kind(facts, profile) != AssetKind.TRUCK) {
            return null;
        }
        String brandModel = profile.fields().get(AssetFields.BRAND_MODEL);
        if (brandModel == null || brandModel.isBlank()) {
            return null;
        }
        String[] parts = brandModel.trim().split("\\s+", 2);
        String year = profile.fields().get(AssetFields.YEAR);
        Integer manualYear = parseYear(year);
        return images.find(tenantCode, new VehicleImages.Query(parts[0], parts.length > 1 ? parts[1] : null,
                manualYear != null ? manualYear : facts.year(), null, WIDTH))
                .map(i -> new ImageView(i.url(), i.expiresAt())).orElse(null);
    }

    private static Integer parseYear(String year) {
        if (year == null) {
            return null;
        }
        try {
            return Integer.valueOf(year.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
