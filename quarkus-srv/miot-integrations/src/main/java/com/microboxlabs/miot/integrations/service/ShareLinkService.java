package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.HarnessThread;
import com.microboxlabs.miot.integrations.domain.ShareLink;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateLinkRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.LinkResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.LinkSnapshot;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryResponse;
import com.microboxlabs.miot.integrations.dto.ThreadResponse;
import com.microboxlabs.miot.integrations.persistence.HarnessThreadRepository;
import com.microboxlabs.miot.integrations.persistence.ShareLinkRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Links that open a read-only snapshot of a story or a chat thread for any
 * member of the organization. Only the owner of the target creates, lists or
 * revokes them. A story or thread that is deleted or expired takes its links
 * out of use with it.
 *
 * <p>The token is kept as issued rather than hashed: it guards content held in
 * the same database, and keeping it lets the owner copy the link again.
 */
@ApplicationScoped
public class ShareLinkService {

    static final String ORG_ACCESS = "org";

    private static final int TOKEN_BYTES = 32;
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{16,64}");
    private static final int DEFAULT_MESSAGE_PAGE = 500;
    private static final int MAX_MESSAGE_PAGE = 1_000;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ShareLinkRepository links;
    private final StoryService stories;
    private final HarnessThreadRepository threads;

    @Inject
    public ShareLinkService(ShareLinkRepository links, StoryService stories, HarnessThreadRepository threads) {
        this.links = links;
        this.stories = stories;
        this.threads = threads;
    }

    /**
     * The target's active link, created when there is none. Null when the
     * caller does not own the target.
     */
    public LinkResponse create(String organization, String tenantCode, String userId, CreateLinkRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("link body is required");
        }
        String type = requireType(request.targetType());
        String targetId = StoryService.requireUuid(request.targetId(), "targetId");
        if (!ownsTarget(tenantCode, userId, type, targetId)) {
            return null;
        }
        List<ShareLink> active = links.listActive(tenantCode, type, targetId);
        if (!active.isEmpty()) {
            return toResponse(organization, active.get(0));
        }
        ShareLink link = links.insert(new ShareLink(newToken(), tenantCode, type, targetId, ORG_ACCESS, userId,
                null));
        // A concurrent request created it first; the unique index kept one.
        return toResponse(organization, link != null ? link : links.listActive(tenantCode, type, targetId).get(0));
    }

    /** The target's active links, or empty when the caller does not own it. */
    public Optional<List<LinkResponse>> list(
            String organization, String tenantCode, String userId, String targetType, String targetId) {
        String type = requireType(targetType);
        String id = StoryService.requireUuid(targetId, "targetId");
        if (!ownsTarget(tenantCode, userId, type, id)) {
            return Optional.empty();
        }
        return Optional.of(links.listActive(tenantCode, type, id).stream()
                .map(link -> toResponse(organization, link))
                .toList());
    }

    /** @return false when there is no such active link or the caller does not own its target. */
    public boolean revoke(String tenantCode, String userId, String token) {
        ShareLink link = activeLink(tenantCode, token);
        if (link == null || !ownsTarget(tenantCode, userId, link.targetType(), link.targetId())) {
            return false;
        }
        return links.revoke(link.token(), tenantCode);
    }

    /**
     * What the link opens, or null when the link is unknown, revoked, or its
     * target is gone. For a thread, {@code after} and {@code limit} page its
     * messages like the thread endpoint does.
     */
    public LinkSnapshot resolve(String tenantCode, String userId, String token, Long after, Integer limit) {
        ShareLink link = activeLink(tenantCode, token);
        if (link == null) {
            return null;
        }
        if (ShareLink.STORY.equals(link.targetType())) {
            StoryResponse story = stories.snapshot(tenantCode, userId, link.targetId());
            return story == null
                    ? null
                    : new LinkSnapshot(link.targetType(), story, story.currentVersion(), null, null);
        }
        HarnessThread thread = threads.find(link.targetId(), tenantCode);
        if (thread == null) {
            return null;
        }
        long cursor = after == null || after < 0 ? 0 : after;
        int page = limit == null || limit <= 0 ? DEFAULT_MESSAGE_PAGE : Math.min(limit, MAX_MESSAGE_PAGE);
        return new LinkSnapshot(link.targetType(), null, null, threadResponse(thread, userId),
                threads.listMessages(thread.id(), cursor, page));
    }

    private ShareLink activeLink(String tenantCode, String token) {
        // A malformed token cannot name a link; it is not worth a query.
        return token == null || !TOKEN.matcher(token).matches() ? null : links.findActive(token, tenantCode);
    }

    private boolean ownsTarget(String tenantCode, String userId, String type, String targetId) {
        if (ShareLink.STORY.equals(type)) {
            StoryService.Access access = stories.access(tenantCode, userId, targetId);
            return access != null && StoryService.OWNER.equals(access.permission());
        }
        HarnessThread thread = threads.find(targetId, tenantCode);
        return thread != null && Objects.equals(thread.ownerId(), userId);
    }

    private static String requireType(String type) {
        if (!ShareLink.STORY.equals(type) && !ShareLink.THREAD.equals(type)) {
            throw new IllegalArgumentException("targetType must be story or thread");
        }
        return type;
    }

    static String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static LinkResponse toResponse(String organization, ShareLink link) {
        return new LinkResponse(
                link.token(),
                link.targetType(),
                link.targetId(),
                link.access(),
                link.createdBy(),
                link.createdAt(),
                "/api/v1/orgs/" + organization + "/links/" + link.token());
    }

    private static ThreadResponse threadResponse(HarnessThread thread, String userId) {
        return new ThreadResponse(
                thread.id(),
                thread.title(),
                thread.summary(),
                thread.model(),
                thread.ownerId(),
                Objects.equals(thread.ownerId(), userId),
                thread.expiresAt(),
                thread.lastMessageAt(),
                thread.createdAt(),
                thread.updatedAt(),
                List.of(),
                thread.titleEdited(),
                thread.kind());
    }
}
