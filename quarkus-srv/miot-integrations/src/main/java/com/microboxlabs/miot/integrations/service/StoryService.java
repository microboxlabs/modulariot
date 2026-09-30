package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.Story;
import com.microboxlabs.miot.integrations.domain.StoryShare;
import com.microboxlabs.miot.integrations.domain.StoryVersion;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.PatchStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.ShareEntry;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryShareRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.VersionInput;
import com.microboxlabs.miot.integrations.persistence.StoryRepository;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Stories: versioned documents kept from chat sessions.
 *
 * <p>Access follows chat threads. A story is private to its owner. A "read"
 * share lets another person open it and its versions; a "write" share also
 * lets them rename it, add versions and pick the current one. Deleting,
 * sharing and links stay with the owner. A caller who may not see a story gets
 * null, as for one that does not exist.
 *
 * <p>Validation throws {@link IllegalArgumentException} (HTTP 400).
 */
@ApplicationScoped
public class StoryService {

    public static final String OWNER = "owner";
    public static final String READ = "read";
    public static final String WRITE = "write";

    /** Story kinds, with the content type a version gets when it names none. */
    static final Map<String, String> KINDS = Map.of(
            "markdown", "text/markdown",
            "html", "text/html",
            "svg", "image/svg+xml",
            "deck", "application/vnd.miot.deck+json",
            "pdf", "application/pdf",
            "sections", "application/vnd.miot.sections+json");

    static final int MAX_CONTENT_BYTES = 5 * 1024 * 1024;
    static final int MAX_METADATA_BYTES = 1024 * 1024;

    private static final int MAX_TITLE_LENGTH = 280;
    private static final int MAX_TEXT_LENGTH = 2_000;
    private static final int MAX_LABEL_LENGTH = 120;
    private static final int MAX_CONTENT_TYPE_LENGTH = 128;
    private static final int MAX_ID_LENGTH = 128;
    private static final int MAX_PRINCIPAL_LENGTH = 256;
    private static final int MAX_SEARCH_LENGTH = 200;
    private static final int DEFAULT_LIMIT = 100;
    private static final int MAX_LIMIT = 200;
    private static final int MAX_VERSIONS = 500;

    private static final Set<String> SHARE_PERMISSIONS = Set.of(READ, WRITE);
    private static final String STORY_ID = "storyId";
    private static final String VERSION_ID = "versionId";

    /** A story and what the caller may do with it. */
    public record Access(Story story, String permission) {
        public boolean canWrite() {
            return OWNER.equals(permission) || WRITE.equals(permission);
        }
    }

    private final StoryRepository repository;

    @Inject
    public StoryService(StoryRepository repository) {
        this.repository = repository;
    }

    /** The caller's stories, then the ones shared with them, each most recently updated first. */
    public List<StoryResponse> list(String tenantCode, String userId, String kind, String search, Integer limit) {
        int bounded = boundLimit(limit);
        String kindFilter = kind == null || kind.isBlank() ? null : requireKind(kind);
        String pattern = titlePattern(search);

        List<Story> owned = repository.listOwned(tenantCode, userId, kindFilter, pattern, bounded);
        Map<String, List<StoryShare>> shares = repository.listSharesFor(owned.stream().map(Story::id).toList());
        List<StoryResponse> out = new ArrayList<>();
        for (Story story : owned) {
            out.add(toResponse(story, OWNER, shares.getOrDefault(story.id(), List.of()), null));
        }
        int remaining = bounded - out.size();
        if (remaining > 0) {
            for (StoryRepository.SharedStory shared
                    : repository.listSharedWith(tenantCode, userId, kindFilter, pattern, remaining)) {
                out.add(toResponse(shared.story(), shared.permission(), List.of(), null));
            }
        }
        return out;
    }

    /** One story with its current version's content. */
    public StoryResponse get(String tenantCode, String userId, String storyId) {
        Access access = access(tenantCode, userId, storyId);
        if (access == null) {
            return null;
        }
        Story story = access.story();
        StoryVersion current = story.currentVersionId() == null
                ? null
                : repository.findVersion(story.id(), story.currentVersionId());
        return toResponse(story, access.permission(), sharesIfOwner(access), current);
    }

    public StoryResponse create(String tenantCode, String userId, CreateStoryRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("story body is required");
        }
        String kind = requireKind(request.kind());
        String title = requireTitle(request.title());
        String description = optionalText(request.description(), "description", MAX_TEXT_LENGTH);
        String sourceThreadId = request.sourceThreadId() == null || request.sourceThreadId().isBlank()
                ? null
                : requireUuid(request.sourceThreadId(), "sourceThreadId");
        String sourceMessageId = optionalText(request.sourceMessageId(), "sourceMessageId", MAX_ID_LENGTH);
        if (request.version() == null) {
            throw new IllegalArgumentException("version is required");
        }
        String storyId = UUID.randomUUID().toString();
        StoryVersion first = validVersion(storyId, kind, null, request.version(), userId);

        Story saved = repository.create(new Story(
                storyId, tenantCode, userId, title, description, kind, sourceThreadId, sourceMessageId,
                first.id(), null, userId, null, userId), first);
        return saved == null ? null : toResponse(saved, OWNER, List.of(), null);
    }

    public StoryResponse patch(String tenantCode, String userId, String storyId, PatchStoryRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("patch body is required");
        }
        String title = request.title() == null ? null : requireTitle(request.title());
        boolean clearDescription = request.description() != null && request.description().isBlank();
        String description = optionalText(request.description(), "description", MAX_TEXT_LENGTH);
        Access access = access(tenantCode, userId, storyId);
        if (access == null || !access.canWrite()) {
            return null;
        }
        Story saved = repository.update(access.story().id(), tenantCode, title, description, clearDescription,
                userId);
        return saved == null ? null : toResponse(saved, access.permission(), sharesIfOwner(access), null);
    }

    public boolean delete(String tenantCode, String userId, String storyId) {
        return repository.softDelete(requireUuid(storyId, STORY_ID), tenantCode, userId);
    }

    /** The version tree without content, oldest first; empty when the story is not visible. */
    public Optional<List<StoryVersion>> listVersions(String tenantCode, String userId, String storyId) {
        return Optional.ofNullable(access(tenantCode, userId, storyId))
                .map(access -> repository.listVersions(access.story().id(), MAX_VERSIONS));
    }

    public StoryVersion getVersion(String tenantCode, String userId, String storyId, String versionId) {
        String version = requireUuid(versionId, VERSION_ID);
        Access access = access(tenantCode, userId, storyId);
        return access == null ? null : repository.findVersion(access.story().id(), version);
    }

    /** Adds a version and makes it current. Its parent defaults to the current version. */
    public StoryVersion addVersion(String tenantCode, String userId, String storyId, VersionInput input) {
        if (input == null) {
            throw new IllegalArgumentException("version body is required");
        }
        Access access = access(tenantCode, userId, storyId);
        if (access == null || !access.canWrite()) {
            return null;
        }
        Story story = access.story();
        String parentId = input.parentId() == null || input.parentId().isBlank()
                ? story.currentVersionId()
                : requireUuid(input.parentId(), "parentId");
        if (parentId != null && repository.findVersion(story.id(), parentId) == null) {
            throw new IllegalArgumentException("parentId is not a version of this story");
        }
        return repository.addVersion(tenantCode, validVersion(story.id(), story.kind(), parentId, input, userId));
    }

    public StoryResponse setCurrentVersion(String tenantCode, String userId, String storyId, String versionId) {
        String version = requireUuid(versionId, VERSION_ID);
        Access access = access(tenantCode, userId, storyId);
        if (access == null || !access.canWrite()) {
            return null;
        }
        Story saved = repository.setCurrentVersion(access.story().id(), tenantCode, version, userId);
        return saved == null ? null : toResponse(saved, access.permission(), sharesIfOwner(access), null);
    }

    public ShareEntry share(String tenantCode, String userId, String storyId, StoryShareRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("share body is required");
        }
        String principal = requireText(request.principal(), "principal", MAX_PRINCIPAL_LENGTH);
        String permission = request.permission() == null || request.permission().isBlank()
                ? READ
                : request.permission();
        if (!SHARE_PERMISSIONS.contains(permission)) {
            throw new IllegalArgumentException("permission must be read or write");
        }
        if (Objects.equals(principal, userId)) {
            throw new IllegalArgumentException("a story is already visible to its owner");
        }
        Story story = ownedStory(tenantCode, userId, storyId);
        if (story == null) {
            return null;
        }
        StoryShare saved = repository.upsertShare(new StoryShare(story.id(), principal, permission, userId, null));
        return saved == null ? null : new ShareEntry(saved.principal(), saved.permission());
    }

    public boolean revokeShare(String tenantCode, String userId, String storyId, String principal) {
        Story story = ownedStory(tenantCode, userId, storyId);
        return story != null
                && repository.deleteShare(story.id(), requireText(principal, "principal", MAX_PRINCIPAL_LENGTH));
    }

    /** What the caller may do with the story, or null when they cannot see it. */
    public Access access(String tenantCode, String userId, String storyId) {
        Story story = repository.find(requireUuid(storyId, STORY_ID), tenantCode);
        if (story == null) {
            return null;
        }
        if (Objects.equals(story.ownerId(), userId)) {
            return new Access(story, OWNER);
        }
        return repository.listShares(story.id()).stream()
                .filter(share -> Objects.equals(share.principal(), userId))
                .findFirst()
                .map(share -> new Access(story, share.permission()))
                .orElse(null);
    }

    /** The story an organization link points at, with its current version. */
    public StoryResponse snapshot(String tenantCode, String userId, String storyId) {
        Story story = repository.find(requireUuid(storyId, STORY_ID), tenantCode);
        if (story == null) {
            return null;
        }
        StoryVersion current = story.currentVersionId() == null
                ? null
                : repository.findVersion(story.id(), story.currentVersionId());
        String permission = Objects.equals(story.ownerId(), userId) ? OWNER : READ;
        return toResponse(story, permission, List.of(), current);
    }

    private Story ownedStory(String tenantCode, String userId, String storyId) {
        Access access = access(tenantCode, userId, storyId);
        return access != null && OWNER.equals(access.permission()) ? access.story() : null;
    }

    private List<StoryShare> sharesIfOwner(Access access) {
        return OWNER.equals(access.permission()) ? repository.listShares(access.story().id()) : List.of();
    }

    private static StoryResponse toResponse(
            Story story, String permission, List<StoryShare> shares, StoryVersion current) {
        return new StoryResponse(
                story.id(),
                story.title(),
                story.description(),
                story.kind(),
                story.ownerId(),
                OWNER.equals(permission),
                permission,
                story.sourceThreadId(),
                story.sourceMessageId(),
                story.currentVersionId(),
                story.createdAt(),
                story.createdBy(),
                story.updatedAt(),
                story.updatedBy(),
                shares.stream().map(share -> new ShareEntry(share.principal(), share.permission())).toList(),
                current);
    }

    private static StoryVersion validVersion(
            String storyId, String kind, String parentId, VersionInput input, String userId) {
        String content = input.content() == null || input.content().isEmpty() ? null : input.content();
        Map<String, Object> metadata = input.metadata() == null || input.metadata().isEmpty()
                ? null
                : input.metadata();
        if (content == null && metadata == null) {
            throw new IllegalArgumentException("a version needs content or metadata");
        }
        if (content != null) {
            int size = content.getBytes(StandardCharsets.UTF_8).length;
            if (size > MAX_CONTENT_BYTES) {
                throw new IllegalArgumentException(
                        "content is too large (" + size + " bytes, limit " + MAX_CONTENT_BYTES + ")");
            }
        }
        if ("pdf".equals(kind)) {
            requireBase64(content);
        }
        if (metadata != null) {
            int size = new JsonObject(metadata).encode().getBytes(StandardCharsets.UTF_8).length;
            if (size > MAX_METADATA_BYTES) {
                throw new IllegalArgumentException(
                        "metadata is too large (" + size + " bytes, limit " + MAX_METADATA_BYTES + ")");
            }
        }
        String contentType = input.contentType() == null || input.contentType().isBlank()
                ? KINDS.get(kind)
                : requireText(input.contentType(), "contentType", MAX_CONTENT_TYPE_LENGTH);
        return new StoryVersion(
                UUID.randomUUID().toString(),
                storyId,
                parentId,
                optionalText(input.label(), "label", MAX_LABEL_LENGTH),
                optionalText(input.summary(), "summary", MAX_TEXT_LENGTH),
                contentType,
                content,
                metadata,
                null,
                userId);
    }

    private static void requireBase64(String content) {
        if (content == null) {
            throw new IllegalArgumentException("a pdf version needs its content, base64-encoded");
        }
        try {
            Base64.getDecoder().decode(content);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("pdf content must be base64");
        }
    }

    private static String requireKind(String kind) {
        if (kind == null || !KINDS.containsKey(kind)) {
            throw new IllegalArgumentException("kind must be one of " + KINDS.keySet().stream().sorted().toList());
        }
        return kind;
    }

    private static String requireTitle(String title) {
        String trimmed = title == null ? "" : title.strip();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("title is required");
        }
        if (trimmed.codePointCount(0, trimmed.length()) <= MAX_TITLE_LENGTH) {
            return trimmed;
        }
        return trimmed.substring(0, trimmed.offsetByCodePoints(0, MAX_TITLE_LENGTH));
    }

    /** An ILIKE pattern matching the text anywhere in the title, with its wildcards escaped. */
    static String titlePattern(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        String text = requireText(search.strip(), "search", MAX_SEARCH_LENGTH);
        return "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private static int boundLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    static String requireUuid(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        try {
            return UUID.fromString(value).toString();
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(field + " must be a UUID");
        }
    }

    private static String requireText(String value, String field, int maxLength) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        if (value.codePointCount(0, value.length()) > maxLength) {
            throw new IllegalArgumentException(field + " must be at most " + maxLength + " characters");
        }
        return value;
    }

    private static String optionalText(String value, String field, int maxLength) {
        return value == null || value.isBlank() ? null : requireText(value, field, maxLength);
    }
}
