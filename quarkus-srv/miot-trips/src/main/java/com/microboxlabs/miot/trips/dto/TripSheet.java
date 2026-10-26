package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.MonitorRun;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.store.BoardStore;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Everything the trip page shows: its card, plan, milestones, the team that confirms each milestone (milestone → team
 * id), the monitor's transitions and the feed's row.
 */
public record TripSheet(
        BoardView.Card card,
        List<StageView> stages,
        List<TripMilestone> milestones,
        Map<String, UUID> confirmers,
        List<MonitorRun.Transition> transitions,
        BoardStore.FeedSource feed) {
}
