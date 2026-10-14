package com.microboxlabs.miot.fleet.directory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** {@link ProfileStore} in memory, for dev mode and tests. Lost on restart. */
public class InMemoryProfileStore implements ProfileStore {

    private final Map<String, Profile> profiles = new ConcurrentHashMap<>();
    private final Map<String, List<Change>> changes = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> dismissed = new ConcurrentHashMap<>();

    private static String key(String organizationId, String assetId) {
        return organizationId + "\u0000" + assetId;
    }

    @Override
    public Map<String, Profile> all(String organizationId) {
        Map<String, Profile> found = new HashMap<>();
        profiles.values().stream().filter(p -> p.organizationId().equals(organizationId))
                .forEach(p -> found.put(p.assetId(), p));
        return found;
    }

    @Override
    public Optional<Profile> find(String organizationId, String assetId) {
        return Optional.ofNullable(profiles.get(key(organizationId, assetId)));
    }

    @Override
    public synchronized Profile save(Profile profile, List<Change> made) {
        String key = key(profile.organizationId(), profile.assetId());
        profiles.put(key, profile);
        changes.computeIfAbsent(key, k -> new ArrayList<>()).addAll(0, made.reversed());
        return profile;
    }

    @Override
    public List<Change> changes(String organizationId, String assetId, int limit) {
        List<Change> found = changes.getOrDefault(key(organizationId, assetId), List.of());
        return List.copyOf(found.subList(0, Math.min(limit, found.size())));
    }

    @Override
    public Map<String, Set<String>> dismissed(String organizationId) {
        Map<String, Set<String>> found = new HashMap<>();
        String prefix = organizationId + "\u0000";
        dismissed.forEach((key, keys) -> {
            if (key.startsWith(prefix)) {
                found.put(key.substring(prefix.length()), Set.copyOf(keys));
            }
        });
        return found;
    }

    @Override
    public void dismiss(String organizationId, String assetId, String key, String by) {
        dismissed.computeIfAbsent(key(organizationId, assetId), k -> new HashSet<>()).add(key);
    }
}
