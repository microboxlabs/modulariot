package com.microboxlabs.miot.core.selectable;

import java.util.List;

/** A service over an in-memory store, for tests outside this package. */
public final class TestSelectables {

    private TestSelectables() {
    }

    public static SelectableService inMemory() {
        return new SelectableService(new InMemorySelectableStore(), List.of(), List.of(), changed -> { });
    }
}
