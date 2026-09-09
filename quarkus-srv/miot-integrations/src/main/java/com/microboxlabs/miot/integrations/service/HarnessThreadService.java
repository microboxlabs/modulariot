package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.HarnessThread;
import com.microboxlabs.miot.integrations.domain.HarnessThreadMessage;
import com.microboxlabs.miot.integrations.domain.HarnessThreadShare;
import com.microboxlabs.miot.integrations.dto.ThreadMessageRequest;
import com.microboxlabs.miot.integrations.dto.ThreadPatchRequest;
import com.microboxlabs.miot.integrations.dto.ThreadResponse;
import com.microboxlabs.miot.integrations.dto.ThreadShareRequest;
import com.microboxlabs.miot.integrations.dto.ThreadUpsertRequest;
import com.microboxlabs.miot.integrations.persistence.HarnessThreadRepository;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Chat threads for the harness panel: transcripts the app reloads after a
 * refresh, plus the sharing and expiry the owner controls.
 *
 * <p>Access is deliberately blunt. A thread is private to its owner; anyone
 * else reaches it only through an explicit share, and a share grants reading
 * only — appending, renaming, sharing and deleting stay with the owner. A
 * caller who may not see a thread gets the same answer as one asking for a
 * thread that does not exist, so the API never confirms an id.
 *
 * <p>Validation throws {@link IllegalArgumentException}, which the resource
 * maps to HTTP 400; "not visible to you" is signalled by a null return, which
 * the resource maps to 404. {@code userId} is required to be a non-blank
 * identity — the resource refuses the request with 401 before calling here, so
 * these methods never have to decide what an anonymous caller owns.
 */
@ApplicationScoped
public class HarnessThreadService {

    /** Payload shape of a stored message when the client does not name one. */
    static final String DEFAULT_FORMAT = "aui-v1";

    /** Column width of harness_thread.title. */
    private static final int MAX_TITLE_LENGTH = 280;

    private static final int MAX_FORMAT_LENGTH = 32;

    /** Matches what the harness accepts back; its own summaries are a few
     * hundred words, so anything near this is not one of them. */
    private static final int MAX_SUMMARY_LENGTH = 8_000;

    private static final int DEFAULT_MESSAGE_PAGE = 500;

    private static final int MAX_MESSAGE_PAGE = 1_000;

    private static final int DEFAULT_LIMIT = 100;

    private static final int MAX_LIMIT = 200;

    /**
     * Ceiling on one stored message. The client strips attachment bodies before
     * persisting — the PDF adapter inlines up to 20 MB as a data URL — but the
     * server cannot take that on trust, and a transcript is not a blob store.
     */
    private static final int MAX_PAYLOAD_BYTES = 256 * 1024;

    private static final Set<String> PERMISSIONS = Set.of("read");

    private static final String THREAD_ID = "threadId";

    private final HarnessThreadRepository repository;

    @Inject
    public HarnessThreadService(HarnessThreadRepository repository) {
        this.repository = repository;
    }

    /** The caller's own threads followed by the ones shared with them, each
     * newest-activity first. */
    public List<ThreadResponse> listVisible(String tenantCode, String userId, Integer limit) {
        int bounded = boundLimit(limit);
        List<HarnessThread> owned = repository.listOwned(tenantCode, userId, bounded);
        // One query for every thread's shares, not one per thread.
        Map<String, List<HarnessThreadShare>> shares =
                repository.listSharesFor(owned.stream().map(HarnessThread::id).toList());

        List<ThreadResponse> out = new ArrayList<>();
        for (HarnessThread thread : owned) {
            out.add(toResponse(thread, userId, shares.getOrDefault(thread.id(), List.of())));
        }
        // `limit` caps the response, not each half of it: asking for 100 and
        // getting 200 back would break any caller paging on the number.
        int remaining = bounded - out.size();
        if (remaining > 0) {
            for (HarnessThread thread : repository.listSharedWith(tenantCode, userId, remaining)) {
                out.add(toResponse(thread, userId, List.of()));
            }
        }
        return out;
    }

    public ThreadResponse create(String tenantCode, String userId, ThreadUpsertRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("thread body is required");
        }
        HarnessThread saved = repository.upsert(new HarnessThread(
                requireUuid(request.id(), "id"),
                tenantCode,
                userId,
                truncateTitle(request.title()),
                null,
                request.expiresAt(),
                null,
                null,
                null));
        // The upsert's owner guard did not match, so this id is someone else's.
        return saved == null ? null : toResponse(saved, userId, repository.listShares(saved.id()));
    }

    public ThreadResponse get(String tenantCode, String userId, String threadId) {
        HarnessThread thread = visibleThread(tenantCode, userId, threadId);
        if (thread == null) {
            return null;
        }
        boolean owned = Objects.equals(thread.ownerId(), userId);
        return toResponse(thread, userId, owned ? repository.listShares(thread.id()) : List.of());
    }

    public ThreadResponse patch(
            String tenantCode, String userId, String threadId, ThreadPatchRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("patch body is required");
        }
        String id = requireUuid(threadId, THREAD_ID);
        if (ownedThread(tenantCode, userId, id) == null) {
            return null;
        }
        HarnessThread saved = repository.update(
                id,
                userId,
                truncateTitle(request.title()),
                request.expiresAt(),
                Boolean.TRUE.equals(request.clearExpiry()),
                optionalText(request.summary(), "summary", MAX_SUMMARY_LENGTH));
        return saved == null ? null : toResponse(saved, userId, repository.listShares(saved.id()));
    }

    public boolean delete(String tenantCode, String userId, String threadId) {
        return repository.softDelete(requireUuid(threadId, THREAD_ID), tenantCode, userId);
    }

    /**
     * Appends (or rewrites) one message. Creates the thread when it is not there
     * yet: the panel mints the id and only persists once there is something to
     * say, so the first message routinely arrives before any explicit create.
     */
    public HarnessThreadMessage appendMessage(
            String tenantCode, String userId, String threadId, ThreadMessageRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("message body is required");
        }
        String id = requireUuid(threadId, THREAD_ID);
        String messageId = requireText(request.id(), "message id", 128);
        Map<String, Object> payload = requirePayload(request.payload());

        HarnessThread existing = repository.find(id, tenantCode);
        if (existing == null) {
            HarnessThread created = repository.upsert(new HarnessThread(
                    id, tenantCode, userId, null, null, null, null, null, null));
            if (created == null) {
                return null;
            }
        } else if (!Objects.equals(existing.ownerId(), userId)) {
            // Readers of a shared thread never write to it.
            return null;
        }

        return repository.appendMessage(new HarnessThreadMessage(
                id,
                messageId,
                optionalText(request.parentId(), "parentId", 128),
                format(request.format()),
                payload,
                0,
                null));
    }

    /**
     * One page of the thread's messages in append order, or null when it is
     * not visible. {@code after} is the last seq the caller already holds; a
     * page shorter than {@code limit} is the last one.
     */
    public List<HarnessThreadMessage> listMessages(
            String tenantCode, String userId, String threadId, Long after, Integer limit) {
        HarnessThread thread = visibleThread(tenantCode, userId, threadId);
        return thread == null
                ? null
                : repository.listMessages(thread.id(), afterSeq(after), boundMessagePage(limit));
    }

    public HarnessThreadShare share(
            String tenantCode, String userId, String threadId, ThreadShareRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("share body is required");
        }
        String id = requireUuid(threadId, THREAD_ID);
        String principal = requireText(request.principal(), "principal", 256);
        String permission = request.permission() == null || request.permission().isBlank()
                ? "read"
                : request.permission();
        if (!PERMISSIONS.contains(permission)) {
            throw new IllegalArgumentException("permission must be one of " + PERMISSIONS);
        }
        if (Objects.equals(principal, userId)) {
            throw new IllegalArgumentException("a thread is already visible to its owner");
        }
        if (ownedThread(tenantCode, userId, id) == null) {
            return null;
        }
        return repository.upsertShare(
                new HarnessThreadShare(id, principal, permission, userId, null));
    }

    /** @return false when the thread is not the caller's to change, and when
     * that principal had no access to begin with — both are "nothing happened"
     * to a caller who may not be told the thread exists. */
    public boolean revokeShare(String tenantCode, String userId, String threadId, String principal) {
        String id = requireUuid(threadId, THREAD_ID);
        if (ownedThread(tenantCode, userId, id) == null) {
            return false;
        }
        return repository.deleteShare(id, requireText(principal, "principal", 256));
    }

    private HarnessThread visibleThread(String tenantCode, String userId, String threadId) {
        HarnessThread thread = repository.find(requireUuid(threadId, THREAD_ID), tenantCode);
        if (thread == null) {
            return null;
        }
        if (Objects.equals(thread.ownerId(), userId)) {
            return thread;
        }
        boolean shared = repository.listShares(thread.id()).stream()
                .anyMatch(share -> Objects.equals(share.principal(), userId));
        return shared ? thread : null;
    }

    private HarnessThread ownedThread(String tenantCode, String userId, String threadId) {
        HarnessThread thread = repository.find(threadId, tenantCode);
        return thread != null && Objects.equals(thread.ownerId(), userId) ? thread : null;
    }

    private ThreadResponse toResponse(
            HarnessThread thread, String userId, List<HarnessThreadShare> shares) {
        boolean owned = Objects.equals(thread.ownerId(), userId);
        Set<String> principals = new LinkedHashSet<>();
        for (HarnessThreadShare share : shares) {
            principals.add(share.principal());
        }
        return new ThreadResponse(
                thread.id(),
                thread.title(),
                thread.summary(),
                thread.ownerId(),
                owned,
                thread.expiresAt(),
                thread.lastMessageAt(),
                thread.createdAt(),
                thread.updatedAt(),
                List.copyOf(principals));
    }

    /** A missing or negative cursor reads from the start. */
    private static long afterSeq(Long after) {
        return after == null || after < 0 ? 0 : after;
    }

    private static int boundMessagePage(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_MESSAGE_PAGE;
        }
        return Math.min(limit, MAX_MESSAGE_PAGE);
    }

    private static int boundLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    private static String requireUuid(String value, String field) {
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
        // Code points, like truncateTitle and the harness's own limit on the
        // summary: an emoji is one character, not two.
        if (value.codePointCount(0, value.length()) > maxLength) {
            throw new IllegalArgumentException(field + " must be at most " + maxLength + " characters");
        }
        return value;
    }

    private static Map<String, Object> requirePayload(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            throw new IllegalArgumentException("payload is required");
        }
        int size = new JsonObject(payload).encode().getBytes(StandardCharsets.UTF_8).length;
        if (size > MAX_PAYLOAD_BYTES) {
            throw new IllegalArgumentException(
                    "payload is too large (" + size + " bytes, limit " + MAX_PAYLOAD_BYTES + ")");
        }
        return payload;
    }

    private static String format(String value) {
        if (value == null || value.isBlank()) {
            return DEFAULT_FORMAT;
        }
        if (value.length() > MAX_FORMAT_LENGTH) {
            throw new IllegalArgumentException(
                    "format must be at most " + MAX_FORMAT_LENGTH + " characters");
        }
        return value;
    }

    private static String truncateTitle(String title) {
        if (title == null) {
            return null;
        }
        String trimmed = title.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        // By code point, not by char: VARCHAR(280) counts characters, and
        // cutting mid-surrogate would corrupt a title ending in an emoji.
        if (trimmed.codePointCount(0, trimmed.length()) <= MAX_TITLE_LENGTH) {
            return trimmed;
        }
        return trimmed.substring(0, trimmed.offsetByCodePoints(0, MAX_TITLE_LENGTH));
    }

    /** Like {@link #requireText} for a field that may legitimately be absent —
     * a length it cannot store is still a 400 rather than a database error. */
    private static String optionalText(String value, String field, int maxLength) {
        return value == null || value.isBlank() ? null : requireText(value, field, maxLength);
    }
}
