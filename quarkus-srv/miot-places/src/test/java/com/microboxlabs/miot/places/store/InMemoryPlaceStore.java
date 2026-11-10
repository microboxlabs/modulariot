package com.microboxlabs.miot.places.store;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * {@link PlaceStore} in memory: active places only; a delete removes the place, and keeps it only until StreamHub
 * no longer has it.
 */
public class InMemoryPlaceStore implements PlaceStore {

    private final Map<UUID, Place> places = new LinkedHashMap<>();
    private final Map<UUID, Place> removed = new LinkedHashMap<>();
    /** Each synced place, as it was when marked. */
    private final Map<UUID, OffsetDateTime> synced = new LinkedHashMap<>();
    private final List<PlaceVersion> versions = new ArrayList<>();
    public final List<UUID> deleted = new ArrayList<>();
    private OffsetDateTime last = OffsetDateTime.MIN;

    /** The time of a write, later than any before it, as the database's clock_timestamp() is. */
    private OffsetDateTime tick() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        last = now.isAfter(last) ? now : last.plusNanos(1000);
        return last;
    }

    @Override
    public Place insert(Place p) {
        OffsetDateTime now = tick();
        Place saved = new Place(UUID.randomUUID(), p.tenantCode(), p.kind(), p.parentId(), p.externalCode(), p.name(),
                p.icon(), p.color(), p.address(), p.categoriesJson(), p.metadataJson(), p.geojson(), p.validFrom(),
                p.validUntil(), p.currentVersion(), now, p.createdBy(), now,
                p.createdBy());
        places.put(saved.id(), saved);
        return saved;
    }

    @Override
    public Optional<Place> find(String tenantCode, UUID id) {
        return Optional.ofNullable(places.get(id)).filter(p -> p.tenantCode().equals(tenantCode));
    }

    @Override
    public Optional<CodeOwner> findByCode(String tenantCode, String code) {
        return places.values().stream()
                .filter(p -> p.tenantCode().equals(tenantCode) && code.equalsIgnoreCase(p.externalCode())).findFirst()
                .map(p -> new CodeOwner(p.id(), p.name(), p.kind(), p.externalCode()));
    }

    @Override
    public List<Place> list(String tenantCode, String kind, UUID parentId, String q, int limit, long offset) {
        return places.values().stream().filter(p -> p.tenantCode().equals(tenantCode))
                .filter(p -> kind == null || kind.equals(p.kind()))
                .filter(p -> parentId == null || parentId.equals(p.parentId()))
                .filter(p -> q == null || p.name().toLowerCase().contains(q.toLowerCase()))
                .sorted(Comparator.comparing(Place::name)).skip(offset).limit(limit).toList();
    }

    @Override
    public List<Place> children(String tenantCode, UUID parentId) {
        return list(tenantCode, null, parentId, null, Integer.MAX_VALUE, 0);
    }

    @Override
    public Optional<Place> update(Place p) {
        return find(p.tenantCode(), p.id()).map(old -> {
            Place saved = new Place(old.id(), old.tenantCode(), old.kind(), p.parentId(), p.externalCode(), p.name(),
                    p.icon(), p.color(), p.address(), p.categoriesJson(), p.metadataJson(), p.geojson(), p.validFrom(),
                    p.validUntil(), p.currentVersion(),
                    old.createdAt(), old.createdBy(), tick(), p.updatedBy());
            places.put(saved.id(), saved);
            return saved;
        });
    }

    @Override
    public boolean delete(String tenantCode, String externalCode, String actor) {
        Optional<UUID> id = findByCode(tenantCode, externalCode).map(CodeOwner::id);
        id.ifPresent(i -> removed.put(i, places.remove(i)));
        id.ifPresent(synced::remove);
        id.ifPresent(deleted::add);
        return id.isPresent();
    }

    @Override
    public boolean markSynced(Place p, boolean deleted) {
        if (!SYNCED_KINDS.contains(p.kind())) {
            return false;
        }
        if (deleted) {
            return removed.remove(p.id()) != null;
        }
        Place current = places.get(p.id());
        if (current == null || !current.updatedAt().equals(p.updatedAt())) {
            return false;
        }
        synced.put(p.id(), p.updatedAt());
        return true;
    }

    @Override
    public void markPending(Place p) {
        synced.remove(p.id());
    }

    @Override
    public List<Pending> pending(int limit) {
        List<Pending> out = new ArrayList<>();
        removed.values().stream().filter(p -> SYNCED_KINDS.contains(p.kind()))
                .forEach(p -> out.add(new Pending(p, true)));
        places.values().stream().filter(p -> SYNCED_KINDS.contains(p.kind()))
                .filter(p -> !p.updatedAt().equals(synced.get(p.id())))
                .forEach(p -> out.add(new Pending(p, false)));
        return out.stream().limit(limit).toList();
    }

    @Override
    public PlaceVersion insertVersion(PlaceVersion v) {
        if (versions.stream().anyMatch(o -> o.placeId().equals(v.placeId()) && o.version().equals(v.version()))) {
            throw new IllegalStateException("another edit saved that version first; reload and try again");
        }
        PlaceVersion saved = new PlaceVersion(UUID.randomUUID(), v.placeId(), v.tenantCode(), v.version(), v.bump(),
                v.reason(), v.changesJson(), v.snapshotJson(), v.createdBy(), OffsetDateTime.now(ZoneOffset.UTC));
        versions.add(saved);
        return saved;
    }

    @Override
    public List<PlaceVersion> versions(String tenantCode, UUID placeId) {
        return versions.stream().filter(v -> v.tenantCode().equals(tenantCode) && v.placeId().equals(placeId))
                .toList();
    }
}
