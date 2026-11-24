package com.microboxlabs.miot.teltonika.profile;

import com.microboxlabs.miot.teltonika.inputs.InputProfile;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Configuration and input profiles, by organization. Blocking. */
public interface ProfileStore {

    List<ConfigProfile> configProfiles(String tenantCode);

    Optional<ConfigProfile> configProfile(UUID id);

    /** Insert or replace. */
    void saveConfig(ConfigProfile profile);

    /** Devices using it lose the reference (they go back to the standard profile). */
    boolean deleteConfig(String tenantCode, UUID id);

    List<InputProfile> inputProfiles(String tenantCode);

    Optional<InputProfile> inputProfile(UUID id);

    /** Insert or replace, with its mappings, in one transaction. */
    void saveInput(InputProfile profile);

    boolean deleteInput(String tenantCode, UUID id);

    /** How many devices use each profile. */
    int devicesUsing(UUID profileId);
}
