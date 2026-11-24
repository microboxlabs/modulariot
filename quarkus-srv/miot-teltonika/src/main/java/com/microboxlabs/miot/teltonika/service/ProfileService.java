package com.microboxlabs.miot.teltonika.service;

import com.microboxlabs.miot.teltonika.inputs.InputMapping;
import com.microboxlabs.miot.teltonika.inputs.InputProfile;
import com.microboxlabs.miot.teltonika.profile.ConfigProfile;
import com.microboxlabs.miot.teltonika.profile.ConfigRules;
import com.microboxlabs.miot.teltonika.profile.ProfileStore;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * An organization's configuration profiles (what its devices should carry) and input profiles (what
 * is wired to each input). Blocking. A profile of another organization is reported as not found.
 */
public final class ProfileService {

    /** Body of a configuration profile; params by parameter ID. */
    public record ConfigRequest(String name, String description, Map<String, String> params) {
    }

    /** One input of an input profile; null booleans take their defaults (active high, events on and off). */
    public record MappingRequest(String source, String meaning, String label, Boolean activeHigh, Double thresholdV,
            Boolean eventOn, Boolean eventOff) {
    }

    public record InputRequest(String name, String description, List<MappingRequest> mappings) {
    }

    /** A profile with how many devices use it. */
    public record ConfigView(ConfigProfile profile, int devices) {
    }

    public record InputView(InputProfile profile, int devices) {
    }

    /** What an input can mean, with the events it produces. */
    public record Meaning(String meaning, String onEvent, String offEvent) {
    }

    private final ProfileStore store;
    private final Runnable inputsChanged;
    private final Clock clock;

    /** @param inputsChanged refreshes the receiver's view after an input profile changes */
    public ProfileService(ProfileStore store, Runnable inputsChanged, Clock clock) {
        this.store = store;
        this.inputsChanged = inputsChanged;
        this.clock = clock;
    }

    public List<ConfigView> configProfiles(String tenant) {
        return store.configProfiles(tenant).stream().map(p -> new ConfigView(p, store.devicesUsing(p.id()))).toList();
    }

    public ConfigView configProfile(String tenant, UUID id) {
        ConfigProfile p = ownedConfig(tenant, id);
        return new ConfigView(p, store.devicesUsing(p.id()));
    }

    public ConfigView saveConfig(String tenant, UUID id, ConfigRequest req, String actor) {
        if (req == null) {
            throw new IllegalArgumentException("body is required");
        }
        String name = name(req.name());
        Map<Integer, String> params = new LinkedHashMap<>();
        if (req.params() != null) {
            req.params().forEach((k, v) -> {
                try {
                    params.put(Integer.parseInt(k.trim()), v);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("parameter IDs are numbers: " + k);
                }
            });
        }
        Map<Integer, String> valid = ConfigRules.validate(params);
        OffsetDateTime now = now();
        ConfigProfile previous = id == null ? null : ownedConfig(tenant, id);
        ConfigProfile p = new ConfigProfile(previous == null ? UUID.randomUUID() : previous.id(), tenant, name,
                trim(req.description()), "fmb9xx", valid, previous == null ? now : previous.createdAt(),
                previous == null ? actor : previous.createdBy(), now, actor);
        store.saveConfig(p);
        return configProfile(tenant, p.id());
    }

    public void deleteConfig(String tenant, UUID id) {
        ConfigProfile p = ownedConfig(tenant, id);
        int using = store.devicesUsing(p.id());
        if (using > 0) {
            throw new IllegalStateException("the profile is used by " + using + " device(s)");
        }
        store.deleteConfig(tenant, p.id());
    }

    public List<InputView> inputProfiles(String tenant) {
        return store.inputProfiles(tenant).stream().map(p -> new InputView(p, store.devicesUsing(p.id()))).toList();
    }

    public InputView inputProfile(String tenant, UUID id) {
        InputProfile p = ownedInput(tenant, id);
        return new InputView(p, store.devicesUsing(p.id()));
    }

    public InputView saveInput(String tenant, UUID id, InputRequest req, String actor) {
        if (req == null) {
            throw new IllegalArgumentException("body is required");
        }
        String name = name(req.name());
        List<InputMapping> mappings = req.mappings() == null ? List.of() : req.mappings().stream()
                .map(m -> new InputMapping(m.source(), m.meaning(), m.label(),
                        m.activeHigh() == null || m.activeHigh(), m.thresholdV(),
                        m.eventOn() == null || m.eventOn(), m.eventOff() == null || m.eventOff()))
                .toList();
        if (mappings.isEmpty()) {
            throw new IllegalArgumentException("an input profile maps at least one input");
        }
        OffsetDateTime now = now();
        InputProfile previous = id == null ? null : ownedInput(tenant, id);
        InputProfile p = new InputProfile(previous == null ? UUID.randomUUID() : previous.id(), tenant, name,
                trim(req.description()), mappings, previous == null ? now : previous.createdAt(),
                previous == null ? actor : previous.createdBy(), now, actor);
        store.saveInput(p);
        if (previous != null) {
            inputsChanged.run();
        }
        return inputProfile(tenant, p.id());
    }

    public void deleteInput(String tenant, UUID id) {
        InputProfile p = ownedInput(tenant, id);
        int using = store.devicesUsing(p.id());
        if (using > 0) {
            throw new IllegalStateException("the profile is used by " + using + " device(s)");
        }
        store.deleteInput(tenant, p.id());
    }

    public static List<Meaning> meanings() {
        return InputMapping.MEANINGS.entrySet().stream().sorted(Map.Entry.comparingByKey())
                .map(e -> new Meaning(e.getKey(), e.getValue().get(0), e.getValue().get(1))).toList();
    }

    ConfigProfile ownedConfig(String tenant, UUID id) {
        return store.configProfile(id).filter(p -> p.tenantCode().equals(tenant))
                .orElseThrow(() -> new NoSuchElementException("configuration profile not found"));
    }

    InputProfile ownedInput(String tenant, UUID id) {
        return store.inputProfile(id).filter(p -> p.tenantCode().equals(tenant))
                .orElseThrow(() -> new NoSuchElementException("input profile not found"));
    }

    private static String name(String name) {
        if (name == null || name.isBlank() || name.trim().length() > 80) {
            throw new IllegalArgumentException("name is required (up to 80 characters)");
        }
        return name.trim();
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }
}
