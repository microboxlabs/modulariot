package com.microboxlabs.miot.fleet.directory;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** The data people set by hand, per organization and asset, with its change history. */
public interface ProfileStore {

    Map<String, Profile> all(String organizationId);

    Optional<Profile> find(String organizationId, String assetId);

    /** Saves the profile and records the changes that led to it. */
    Profile save(Profile profile, List<Change> changes);

    List<Change> changes(String organizationId, String assetId, int limit);

    /** Dismissed suggestions of every asset, as {@code kind=value} keys. */
    Map<String, Set<String>> dismissed(String organizationId);

    void dismiss(String organizationId, String assetId, String key, String by);
}
