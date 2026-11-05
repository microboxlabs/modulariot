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

/** {@link PlaceStore} in memory: active places only; a delete removes the place. */
public class InMemoryPlaceStore implements PlaceStore {

    private final Map<UUID, Place> places = new LinkedHashMap<>();
    private final List<PlaceVersion> versions = new ArrayList<>();
    public final List<UUID> deleted = new ArrayList<>();

    @Override
    public Place insert(Place p) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
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
                .map(p -> new CodeOwner(p.id(), p.name(), p.kind()));
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
                    old.createdAt(), old.createdBy(), OffsetDateTime.now(ZoneOffset.UTC), p.updatedBy());
            places.put(saved.id(), saved);
            return saved;
        });
    }

    @Override
    public boolean delete(String tenantCode, UUID id, String actor) {
        if (find(tenantCode, id).isEmpty()) {
            return false;
        }
        places.remove(id);
        deleted.add(id);
        return true;
    }

    @Override
    public int deleteChildren(String tenantCode, UUID parentId, String actor) {
        List<UUID> children = children(tenantCode, parentId).stream().map(Place::id).toList();
        children.forEach(id -> delete(tenantCode, id, actor));
        return children.size();
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
