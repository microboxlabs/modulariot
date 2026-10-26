package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.dto.FeedProfileRequest;
import com.microboxlabs.miot.trips.dto.FeedProfileView;
import com.microboxlabs.miot.trips.store.FeedStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.LinkedHashSet;
import java.util.ArrayList;
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
    private final AuditService audit;

    @Inject
    public FeedProfileService(FeedStore feeds, AuditService audit) {
        this.feeds = feeds;
        this.audit = audit;
    }

    public List<FeedProfile> list(String tenantCode) {
        return feeds.profiles(tenantCode);
    }

    /** Every feed with how many of its services are open. */
    public List<FeedProfileView> views(String tenantCode) {
        Map<String, Integer> open = feeds.openServices(tenantCode);
        return feeds.profiles(tenantCode).stream()
                .map(p -> FeedProfileView.of(p, open.getOrDefault(p.feedKey(), 0))).toList();
    }

    /** The saved profile with how many of its services are open. */
    public FeedProfileView saveView(String tenantCode, String actor, String feedKey, FeedProfileRequest body) {
        FeedProfile saved = save(tenantCode, actor, feedKey, body);
        return FeedProfileView.of(saved, feeds.openServices(tenantCode).getOrDefault(saved.feedKey(), 0));
    }

    /** Creates a profile without replacing existing rules, even when another creator wins a race. */
    public FeedProfileView createView(String tenantCode, String actor, String feedKey, FeedProfileRequest body) {
        FeedProfile saved = save(tenantCode, actor, feedKey, body, true);
        return FeedProfileView.of(saved, 0);
    }

    /** Creates or replaces the feed's rules. */
    public FeedProfile save(String tenantCode, String actor, String feedKey, FeedProfileRequest body) {
        return save(tenantCode, actor, feedKey, body, false);
    }

    private FeedProfile save(String tenantCode, String actor, String feedKey, FeedProfileRequest body,
            boolean createOnly) {
        String key = Check.required(feedKey, FEED_KEY, 64);
        if (!key.matches("[a-z0-9][a-z0-9-]*")) {
            throw new IllegalArgumentException("feedKey must be lowercase letters, digits and dashes");
        }
        if (body == null) {
            throw new IllegalArgumentException("body is required");
        }
        List<FeedProfile.StagePlan> stages = normalizedStages(body.stages());
        if (stages.isEmpty()) {
            throw new IllegalArgumentException("stages must list at least one stage");
        }
        Set<String> types = stages.stream().map(FeedProfile.StagePlan::stageType)
                .collect(java.util.stream.Collectors.toSet());
        String arrival = Check.required(body.arrivalStage(), "arrivalStage", 32);
        if (!types.contains(arrival)) {
            throw new IllegalArgumentException("arrivalStage must be a stage of the plan");
        }
        Set<String> required = new LinkedHashSet<>(body.requiredResources() == null
                ? List.of("truck", "driver") : body.requiredResources());
        if (required.contains(null) || !RESOURCES.containsAll(required)) {
            throw new IllegalArgumentException("requiredResources must be among " + RESOURCES);
        }
        FeedProfile profile = new FeedProfile(tenantCode, key,
                Check.required(body.name(), "name", 255), stages, arrival, required,
                body.active() == null || body.active(), null, actor, null, actor);
        FeedProfile saved = createOnly ? feeds.createProfile(profile)
                .orElseThrow(() -> new IllegalStateException("feed " + key + " already exists"))
                : feeds.saveProfile(profile);
        audit.log(tenantCode, actor, "feed.profile_saved", "feed", key, null, Map.of(STAGES, types.toString()));
        return saved;
    }
    private static List<FeedProfile.StagePlan> normalizedStages(List<FeedProfile.StagePlan> requested) {
        List<FeedProfile.StagePlan> stages = requested == null ? List.of() : requested;
        List<FeedProfile.StagePlan> normalized = new ArrayList<>();
        Set<String> types = new LinkedHashSet<>();
        for (FeedProfile.StagePlan s : stages) {
            String type = Check.oneOf(Check.required(s == null ? null : s.stageType(), "stageType", 32), "stageType",
                    "preparation", "loading", "transit", "stop", "unloading", "closing");
            if (!types.add(type)) {
                throw new IllegalArgumentException("stage " + type + " is listed twice");
            }
            normalized.add(new FeedProfile.StagePlan(type, Check.limitedOrNull(s.serviceStatus(), "serviceStatus", 64)));
        }
        return List.copyOf(normalized);
    }

}
