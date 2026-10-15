package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/** Read access to what the integrations know: GPS signals and trips. */
public interface FleetData {

    /** Every asset the given GPS clients see: shared with them, or sent by them. */
    List<AssetFacts> assets(Set<String> clientIds);

    /** Planned trips of one asset, earliest first. */
    List<TripView> plannedTrips(String assetId);

    /** Finished trips of one asset, newest first. */
    List<TripView> recentTrips(String assetId, int limit);

    /** Activity of every asset in the hour [from, to), from its signals. */
    List<ActivityHour> activity(Instant from, Instant to);
}
