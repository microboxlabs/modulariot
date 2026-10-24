package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.dto.FeedProfileRequest;
import com.microboxlabs.miot.trips.store.FeedStore;
import com.microboxlabs.miot.trips.store.MonitorStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The rules of each feed; checked here so the reconciler can trust them. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class FeedProfileService {

    private static final String STAGES = "stages";
    private static final String FEED_KEY = "feedKey";
    private static final Set<String> RESOURCES = Set.of("truck", "trailer", "driver");

    private final FeedStore feeds;
    private final MonitorStore monitors;
    private final AuditService audit;

    @Inject
    public FeedProfileService(FeedStore feeds, MonitorStore monitors, AuditService audit) {
        this.feeds = feeds;
        this.monitors = monitors;
        this.audit = audit;
    }

    public List<FeedProfile> list(String tenantCode) {
        return feeds.profiles(tenantCode);
    }

    /** Creates or replaces the feed's rules. */
    public FeedProfile save(String tenantCode, String actor, String feedKey, FeedProfileRequest body) {
        String key = Check.required(feedKey, FEED_KEY, 64);
        if (!key.matches("[a-z0-9][a-z0-9-]*")) {
            throw new IllegalArgumentException("feedKey must be lowercase letters, digits and dashes");
        }
        if (body == null) {
            throw new IllegalArgumentException("body is required");
        }
        List<FeedProfile.StagePlan> stages = body.stages() == null ? List.of() : body.stages();
        if (stages.isEmpty()) {
            throw new IllegalArgumentException("stages must list at least one stage");
        }
        Set<String> types = new LinkedHashSet<>();
        for (FeedProfile.StagePlan s : stages) {
            String type = Check.oneOf(Check.required(s == null ? null : s.stageType(), "stageType", 32), "stageType",
                    "preparation", "loading", "transit", "stop", "unloading", "closing");
            if (!types.add(type)) {
                throw new IllegalArgumentException("stage " + type + " is listed twice");
            }
            Check.limitedOrNull(s.serviceStatus(), "serviceStatus", 64);
        }
        String arrival = Check.required(body.arrivalStage(), "arrivalStage", 32);
        if (!types.contains(arrival)) {
            throw new IllegalArgumentException("arrivalStage must be a stage of the plan");
        }
        String monitor = Check.limitedOrNull(body.monitor(), "monitor", 64);
        if (monitor != null && monitors.versions(tenantCode, monitor).stream()
                .noneMatch(m -> TripMonitor.PUBLISHED.equals(m.status()))) {
            throw new IllegalArgumentException("monitor " + monitor + " has no published version");
        }
        Set<String> required = new LinkedHashSet<>(body.requiredResources() == null
                ? List.of("truck", "driver") : body.requiredResources());
        if (!RESOURCES.containsAll(required)) {
            throw new IllegalArgumentException("requiredResources must be among " + RESOURCES);
        }
        FeedProfile saved = feeds.saveProfile(new FeedProfile(tenantCode, key,
                Check.required(body.name(), "name", 255), stages, arrival, monitor, required,
                body.active() == null || body.active(), null, actor, null, actor));
        audit.log(tenantCode, actor, "feed.profile_saved", "feed", key, null, Map.of(STAGES, types.toString()));
        return saved;
    }
}
