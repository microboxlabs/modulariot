package com.microboxlabs.miot.places.dto;

import com.microboxlabs.miot.places.store.PlaceStore.CodeOwner;
import java.util.Optional;

/** Whether an organization's external code is taken, and by which place. */
public record CodeUsageView(boolean inUse, String placeId, String name, String kind) {

    public static CodeUsageView of(Optional<CodeOwner> owner) {
        return owner.map(o -> new CodeUsageView(true, o.id().toString(), o.name(), o.kind()))
                .orElseGet(() -> new CodeUsageView(false, null, null, null));
    }
}
