package com.microboxlabs.miot.places.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.places.dto.PlaceRequest;
import com.microboxlabs.miot.places.dto.PlaceRequest.VersionRequest;
import com.microboxlabs.miot.places.dto.PlaceView;
import com.microboxlabs.miot.places.store.PlaceStore;
import com.microboxlabs.miot.places.store.PlaceStore.Place;
import com.microboxlabs.miot.places.store.PlaceStore.PlaceVersion;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The organization's saved places: geofences, the inner geofences inside them, and routes. A geofence is saved with
 * its inner geofences; an inner geofence is never saved on its own. Deletes are logical.
 *
 * <p>Every geofence and route has a version. Creating one gives {@value #FIRST_VERSION}; every edit says its size,
 * {@code MAJOR}, {@code MINOR} or {@code PATCH}, and a description, and gives the next version: {@code 1.2.3} becomes
 * {@code 2.0.0}, {@code 1.3.0} or {@code 1.2.4}. The service picks the number under the place's row lock, so two edits
 * never get the same one, and keeps each version with the place as it was saved.
 *
 * <p>Every place has an {@code externalCode}, an inner geofence too. With the organization it is a geofence's key
 * in the GPS geofences ({@code client_id}, {@code client_geofence_id}). Once set, the code of a geofence or an inner
 * geofence does not change; a route's can, as a route is only used in Lugares. Deleting a place frees its code.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class PlaceService {

    public static final int DEFAULT_PAGE_SIZE = 500;
    public static final int MAX_PAGE_SIZE = 2000;
    public static final String FIRST_VERSION = "1.0.0";
    public static final List<String> BUMPS = List.of("MAJOR", "MINOR", "PATCH");

    private static final int MAX_INNERS = 500;
    private static final int MAX_CHANGES = 200;
    private static final String KIND_MUST_BE = "kind must be one of ";
    private static final String INNER_IN_ITS_GEOFENCE = "an inner geofence is saved with its geofence, in its inners";
    private static final ObjectMapper MAPPER = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final PlaceStore store;
    private final Transactions tx;

    @Inject
    public PlaceService(PlaceStore store, Transactions tx) {
        this.store = store;
        this.tx = tx;
    }

    /** A saved geofence or route with its inner geofences (none for a route). */
    public record Saved(Place place, List<Place> inners) {
    }

    /** By name or code; {@code kind} and {@code parentId} filter. Zero-based {@code page}. */
    public List<Place> list(String tenantCode, String kind, UUID parentId, String q, Integer size, Integer page) {
        int s = size == null ? DEFAULT_PAGE_SIZE : size;
        int p = page == null ? 0 : page;
        if (s < 1 || s > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MAX_PAGE_SIZE);
        }
        if (p < 0) {
            throw new IllegalArgumentException("page must be nonnegative");
        }
        String k = text(kind, "kind", 16);
        if (k != null) {
            kind(k);
        }
        return store.list(tenantCode, k, parentId, text(q, "q", 255), s, (long) p * s);
    }

    public Place get(String tenantCode, UUID id) {
        return store.find(tenantCode, id).orElseThrow(() -> notFound(id));
    }

    /** Who holds the code in the organization, so a form can say it is taken before saving. */
    public Optional<PlaceStore.CodeOwner> codeOwner(String tenantCode, String code) {
        String c = text(code, "code", 128);
        if (c == null) {
            throw new IllegalArgumentException("code is required");
        }
        return store.findByCode(tenantCode, c);
    }

    /** The place with its inner geofences. */
    public Saved getWithInners(String tenantCode, UUID id) {
        Place place = get(tenantCode, id);
        return new Saved(place, PlaceStore.GEOFENCE.equals(place.kind()) ? store.children(tenantCode, id) : List.of());
    }

    /** A geofence (with its inner geofences) or a route, at {@value #FIRST_VERSION}. */
    public Saved create(String tenantCode, PlaceRequest request, String actor) {
        String kind = newKind(required(request).kind());
        if (request.version() != null) {
            throw new IllegalArgumentException("a new place starts at " + FIRST_VERSION + "; it takes no version");
        }
        return tx.inTransaction(() -> {
            Place created = store.insert(place(tenantCode, null, kind, request, actor, FIRST_VERSION));
            List<Place> inners = saveInners(tenantCode, created, request.inners(), actor);
            Saved saved = new Saved(created, inners);
            recordVersion(saved, null, null, List.of(), actor);
            return saved;
        });
    }

    /**
     * Replaces a geofence (and, with {@code inners}, its inner geofences) or a route as its next version. Its kind
     * cannot change.
     */
    public Saved update(String tenantCode, UUID id, PlaceRequest request, String actor) {
        VersionRequest version = required(request).version();
        String bump = bump(version);
        String reason = text(version.reason(), "version.reason", 2000);
        List<String> changes = changes(version.changes());
        return tx.inTransaction(() -> {
            Place current = get(tenantCode, id);
            topLevel(current.kind());
            String kind = text(request.kind(), "kind", 16);
            if (kind != null && !kind.equals(current.kind())) {
                throw new IllegalArgumentException("the kind of a place cannot change");
            }
            String next = next(current.currentVersion(), bump);
            Place edited = place(tenantCode, id, current.kind(), request, actor, next);
            if (!PlaceStore.ROUTE.equals(current.kind())) {
                sameCode(current, edited.externalCode());
            }
            Place changed = store.update(edited).orElseThrow(() -> notFound(id));
            List<Place> inners = request.inners() == null && PlaceStore.GEOFENCE.equals(changed.kind())
                    ? store.children(tenantCode, id)
                    : saveInners(tenantCode, changed, request.inners(), actor);
            Saved saved = new Saved(changed, inners);
            recordVersion(saved, bump, reason, changes, actor);
            return saved;
        });
    }

    /** Deletes a geofence, with its inner geofences, or a route. */
    public void delete(String tenantCode, UUID id, String actor) {
        tx.inTransaction(() -> {
            Place current = get(tenantCode, id);
            topLevel(current.kind());
            if (PlaceStore.GEOFENCE.equals(current.kind())) {
                store.deleteChildren(tenantCode, id, actor);
            }
            if (!store.delete(tenantCode, id, actor)) {
                throw notFound(id);
            }
        });
    }

    /** The versions of a geofence or route, oldest first. */
    public List<PlaceVersion> versions(String tenantCode, UUID id) {
        topLevel(get(tenantCode, id).kind());
        return store.versions(tenantCode, id);
    }

    /** {@code 1.2.3} and MAJOR, MINOR or PATCH give {@code 2.0.0}, {@code 1.3.0} or {@code 1.2.4}. */
    static String next(String current, String bump) {
        String[] parts = (current == null ? FIRST_VERSION : current).split("\\.");
        int major = Integer.parseInt(parts[0]);
        int minor = Integer.parseInt(parts[1]);
        int patch = Integer.parseInt(parts[2]);
        return switch (bump) {
            case "MAJOR" -> (major + 1) + ".0.0";
            case "MINOR" -> major + "." + (minor + 1) + ".0";
            default -> major + "." + minor + "." + (patch + 1);
        };
    }

    /**
     * The geofence's inner geofences become {@code requested}: one with the id of a current inner geofence replaces
     * it, one without an id is new, and a current one left out is deleted. A route has none.
     */
    private List<Place> saveInners(String tenantCode, Place parent, List<PlaceRequest> requested, String actor) {
        if (!PlaceStore.GEOFENCE.equals(parent.kind())) {
            if (requested != null && !requested.isEmpty()) {
                throw new IllegalArgumentException("only a geofence has inner geofences");
            }
            return List.of();
        }
        if (requested == null) {
            return List.of();
        }
        if (requested.size() > MAX_INNERS) {
            throw new IllegalArgumentException("a geofence has at most " + MAX_INNERS + " inner geofences");
        }
        Map<UUID, Place> current = store.children(tenantCode, parent.id()).stream()
                .collect(Collectors.toMap(Place::id, Function.identity()));
        List<UUID> ids = innerIds(requested, current, parent.id());
        for (UUID gone : current.keySet()) {
            // the ones left out go first, so a new one can take a code they freed
            if (!ids.contains(gone)) {
                store.delete(tenantCode, gone, actor);
            }
        }
        List<Place> saved = new ArrayList<>();
        for (int i = 0; i < requested.size(); i++) {
            UUID innerId = ids.get(i);
            Place p = innerPlace(tenantCode, innerId, parent.id(), requested.get(i), actor);
            saved.add(innerId == null ? store.insert(p) : store.update(p).orElseThrow(() -> notFound(innerId)));
        }
        return saved;
    }

    /**
     * The current inner geofence each requested one replaces, in order, or null for a new one. Each id must be one
     * of this geofence's and come once; its code cannot change.
     */
    private static List<UUID> innerIds(List<PlaceRequest> requested, Map<UUID, Place> current, UUID parentId) {
        List<UUID> ids = new ArrayList<>();
        Set<UUID> kept = new HashSet<>();
        for (PlaceRequest r : requested) {
            if (r == null) {
                throw new IllegalArgumentException("an inner geofence is required");
            }
            inner(r, parentId);
            String rawId = text(r.id(), "inners.id", 64);
            UUID innerId = rawId == null ? null : uuid(rawId, "inners.id");
            if (innerId != null) {
                if (!current.containsKey(innerId)) {
                    throw new IllegalArgumentException("inner geofence " + innerId + " is not one of this geofence's");
                }
                if (!kept.add(innerId)) {
                    throw new IllegalArgumentException("inner geofence " + innerId + " comes twice");
                }
                sameCode(current.get(innerId), text(r.externalCode(), "inners.externalCode", 128));
            }
            ids.add(innerId);
        }
        return ids;
    }

    /** An item of {@code inners}: an inner geofence of this geofence, with no inners or version of its own. */
    private static void inner(PlaceRequest r, UUID parentId) {
        String kind = text(r.kind(), "inners.kind", 16);
        if (kind != null && !PlaceStore.INNER_GEOFENCE.equals(kind)) {
            throw new IllegalArgumentException("an item of inners is an inner geofence");
        }
        String parent = text(r.parentId(), "inners.parentId", 64);
        if (parent != null && !parent.equals(parentId.toString())) {
            throw new IllegalArgumentException("an item of inners belongs to this geofence");
        }
        if (r.inners() != null || r.version() != null) {
            throw new IllegalArgumentException("an inner geofence has no inners or version of its own");
        }
    }

    private Place innerPlace(String tenantCode, UUID id, UUID parentId, PlaceRequest r, String actor) {
        Place p = place(tenantCode, id, PlaceStore.INNER_GEOFENCE, r, actor, null);
        return new Place(p.id(), p.tenantCode(), p.kind(), parentId, p.externalCode(), p.name(), p.icon(), p.color(),
                p.address(), p.categoriesJson(), p.metadataJson(), p.geojson(), p.validFrom(), p.validUntil(), null,
                null, actor, null, actor);
    }

    private Place place(String tenantCode, UUID id, String kind, PlaceRequest r, String actor,
            String version) {
        if (r.validFrom() != null && r.validUntil() != null && !r.validFrom().isBefore(r.validUntil())) {
            throw new IllegalArgumentException("validFrom must be before validUntil");
        }
        if (!PlaceStore.INNER_GEOFENCE.equals(kind) && text(r.parentId(), "parentId", 64) != null) {
            throw new IllegalArgumentException("only an inner geofence has a parent");
        }
        String name = text(r.name(), "name", 255);
        if (name == null) {
            throw new IllegalArgumentException("name is required");
        }
        String code = text(r.externalCode(), "externalCode", 128);
        if (code == null) {
            throw new IllegalArgumentException("externalCode is required");
        }
        return new Place(id, tenantCode, kind, null, code, name,
                text(r.icon(), "icon", 64), text(r.color(), "color", 16), text(r.address(), "address", 2000),
                categories(r.categories()), metadata(r.metadata()), PlaceShapes.feature(kind, r.geojson()),
                r.validFrom(), r.validUntil(), version, null, actor, null, actor);
    }

    /** A code, once set, stays: it is how the GPS geofences find the place. One not set yet can be set. */
    private static void sameCode(Place current, String code) {
        if (current.externalCode() != null && !current.externalCode().equals(code)) {
            throw new IllegalArgumentException("the externalCode of a place cannot change; it is "
                    + current.externalCode());
        }
    }

    /** Keeps the version with the place as it was saved. */
    private void recordVersion(Saved saved, String bump, String reason, List<String> changes, String actor) {
        Place p = saved.place();
        store.insertVersion(new PlaceVersion(null, p.id(), p.tenantCode(), p.currentVersion(), bump, reason,
                json(changes), json(PlaceView.of(p, saved.inners())), actor, null));
    }

    private static String topLevel(String kind) {
        if (PlaceStore.INNER_GEOFENCE.equals(kind)) {
            throw new IllegalArgumentException(INNER_IN_ITS_GEOFENCE);
        }
        return kind;
    }

    /**
     * The kind of a new place, checked in one place: missing, unknown or an inner geofence is a 400. Validating it
     * here, rather than passing a possibly-null kind on to {@link #kind(String)}, keeps every call's argument valid.
     */
    private static String newKind(String raw) {
        String kind = text(raw, "kind", 16);
        if (kind == null || !PlaceStore.KINDS.contains(kind)) {
            throw new IllegalArgumentException(KIND_MUST_BE + PlaceStore.KINDS);
        }
        if (PlaceStore.INNER_GEOFENCE.equals(kind)) {
            throw new IllegalArgumentException(INNER_IN_ITS_GEOFENCE);
        }
        return kind;
    }

    private static String bump(VersionRequest version) {
        if (version == null) {
            throw new IllegalArgumentException("an edit needs its version: bump (MAJOR, MINOR or PATCH) and reason");
        }
        String bump = text(version.bump(), "version.bump", 8);
        if (bump == null || !BUMPS.contains(bump)) {
            throw new IllegalArgumentException("version.bump must be one of " + BUMPS);
        }
        return bump;
    }

    private static List<String> changes(List<String> changes) {
        if (changes == null) {
            return List.of();
        }
        if (changes.size() > MAX_CHANGES) {
            throw new IllegalArgumentException("version.changes has at most " + MAX_CHANGES + " lines");
        }
        List<String> out = new ArrayList<>();
        for (String c : changes) {
            String t = text(c, "version.changes", 500);
            if (t != null) {
                out.add(t);
            }
        }
        return out;
    }

    private static PlaceRequest required(PlaceRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("a place is required");
        }
        return request;
    }

    private static String kind(String kind) {
        if (kind == null || !PlaceStore.KINDS.contains(kind)) {
            throw new IllegalArgumentException(KIND_MUST_BE + PlaceStore.KINDS);
        }
        return kind;
    }

    private static UUID uuid(String raw, String field) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(field + " must be a UUID");
        }
    }

    /** Without values there are no categories: null, nothing to look up. With values, their selectable is required. */
    private static String categories(PlaceRequest.Categories categories) {
        if (categories == null || categories.values() == null) {
            return null;
        }
        List<String> values = categories.values().stream().filter(Objects::nonNull).map(String::trim)
                .filter(c -> !c.isEmpty()).distinct().toList();
        if (values.isEmpty()) {
            return null;
        }
        String selectable = text(categories.selectable(), "categories.selectable", 128);
        if (selectable == null) {
            throw new IllegalArgumentException("categories.selectable is required with categories.values");
        }
        return json(new PlaceRequest.Categories(selectable, values));
    }

    private static String metadata(JsonNode metadata) {
        if (metadata == null || metadata.isNull()) {
            return "{}";
        }
        if (!metadata.isObject()) {
            throw new IllegalArgumentException("metadata must be an object");
        }
        return json(metadata);
    }

    private static String json(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("a value could not be written as JSON", e);
        }
    }

    /** Trimmed; blank is null. */
    private static String text(String value, String field, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String t = value.trim();
        if (t.length() > max) {
            throw new IllegalArgumentException(field + " is longer than " + max + " characters");
        }
        return t;
    }

    private static NoSuchElementException notFound(UUID id) {
        return new NoSuchElementException("place " + id + " not found");
    }
}
