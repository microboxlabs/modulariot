package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.HarnessThread;
import com.microboxlabs.miot.integrations.domain.HarnessThreadMessage;
import com.microboxlabs.miot.integrations.domain.ShareLink;
import com.microboxlabs.miot.integrations.domain.Story;
import com.microboxlabs.miot.integrations.domain.StoryShare;
import com.microboxlabs.miot.integrations.domain.StoryVersion;
import com.microboxlabs.miot.integrations.persistence.HarnessThreadRepository;
import com.microboxlabs.miot.integrations.persistence.ShareLinkRepository;
import com.microboxlabs.miot.integrations.persistence.StoryRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/** In-memory stand-ins for the story, link and thread repositories, with the rules their SQL enforces. */
public final class InMemoryStories {

    public final Stories stories = new Stories();
    public final Links links = new Links();
    public final Threads threads = new Threads();
    public final StoryService storyService = new StoryService(stories);
    public final ShareLinkService linkService = new ShareLinkService(links, storyService, threads);

    public static final class Stories extends StoryRepository {
        public final Map<String, Story> rows = new LinkedHashMap<>();
        public final Set<String> deleted = new HashSet<>();
        public final Map<String, List<StoryVersion>> versions = new LinkedHashMap<>();
        public final Map<String, List<StoryShare>> shares = new LinkedHashMap<>();

        @Override
        public Story create(Story story, StoryVersion first) {
            OffsetDateTime now = OffsetDateTime.now();
            Story saved = new Story(story.id(), story.tenantCode(), story.ownerId(), story.title(),
                    story.description(), story.kind(), story.sourceThreadId(), story.sourceMessageId(),
                    first.id(), now, story.createdBy(), now, story.updatedBy());
            rows.put(saved.id(), saved);
            String label = first.label() == null ? "v1" : first.label();
            versions.put(saved.id(), new ArrayList<>(List.of(stamped(first, label))));
            return saved;
        }

        @Override
        public List<Story> listOwned(String tenantCode, String ownerId, String kind, String titlePattern, int limit) {
            return live(tenantCode).filter(s -> Objects.equals(s.ownerId(), ownerId))
                    .filter(s -> matches(s, kind, titlePattern)).limit(limit).toList();
        }

        @Override
        public List<SharedStory> listSharedWith(
                String tenantCode, String principal, String kind, String titlePattern, int limit) {
            List<SharedStory> out = new ArrayList<>();
            live(tenantCode).filter(s -> matches(s, kind, titlePattern)).forEach(s ->
                    shares.getOrDefault(s.id(), List.of()).stream()
                            .filter(share -> Objects.equals(share.principal(), principal))
                            .forEach(share -> out.add(new SharedStory(s, share.permission()))));
            return out.stream().limit(limit).toList();
        }

        @Override
        public Story find(String storyId, String tenantCode) {
            return live(tenantCode).filter(s -> s.id().equals(storyId)).findFirst().orElse(null);
        }

        @Override
        public Story update(
                String storyId, String tenantCode, String title, String description, boolean clearDescription,
                String actor) {
            Story s = find(storyId, tenantCode);
            if (s == null) {
                return null;
            }
            String newDescription = description == null ? s.description() : description;
            if (clearDescription) {
                newDescription = null;
            }
            return put(new Story(s.id(), s.tenantCode(), s.ownerId(), title == null ? s.title() : title,
                    newDescription, s.kind(), s.sourceThreadId(), s.sourceMessageId(), s.currentVersionId(),
                    s.createdAt(), s.createdBy(), OffsetDateTime.now(), actor));
        }

        @Override
        public boolean softDelete(String storyId, String tenantCode, String ownerId) {
            Story s = find(storyId, tenantCode);
            if (s == null || !Objects.equals(s.ownerId(), ownerId)) {
                return false;
            }
            return deleted.add(storyId);
        }

        @Override
        public StoryVersion addVersion(String tenantCode, StoryVersion version) {
            Story s = find(version.storyId(), tenantCode);
            if (s == null) {
                return null;
            }
            List<StoryVersion> list = versions.get(s.id());
            StoryVersion saved = stamped(version,
                    version.label() == null ? "v" + (list.size() + 1) : version.label());
            list.add(saved);
            setCurrentVersion(s.id(), tenantCode, saved.id(), version.createdBy());
            return saved;
        }

        @Override
        public Story setCurrentVersion(String storyId, String tenantCode, String versionId, String actor) {
            Story s = find(storyId, tenantCode);
            if (s == null || findVersion(storyId, versionId) == null) {
                return null;
            }
            return put(new Story(s.id(), s.tenantCode(), s.ownerId(), s.title(), s.description(), s.kind(),
                    s.sourceThreadId(), s.sourceMessageId(), versionId, s.createdAt(), s.createdBy(),
                    OffsetDateTime.now(), actor));
        }

        @Override
        public List<StoryVersion> listVersions(String storyId, int limit) {
            return versions.getOrDefault(storyId, List.of()).stream()
                    .map(v -> new StoryVersion(v.id(), v.storyId(), v.parentId(), v.label(), v.summary(),
                            v.contentType(), null, null, v.createdAt(), v.createdBy()))
                    .limit(limit).toList();
        }

        @Override
        public StoryVersion findVersion(String storyId, String versionId) {
            return versions.getOrDefault(storyId, List.of()).stream()
                    .filter(v -> v.id().equals(versionId)).findFirst().orElse(null);
        }

        @Override
        public StoryShare upsertShare(StoryShare share) {
            List<StoryShare> list = shares.computeIfAbsent(share.storyId(), k -> new ArrayList<>());
            list.removeIf(s -> s.principal().equals(share.principal()));
            StoryShare saved = new StoryShare(share.storyId(), share.principal(), share.permission(),
                    share.createdBy(), OffsetDateTime.now());
            list.add(saved);
            return saved;
        }

        @Override
        public boolean deleteShare(String storyId, String principal) {
            return shares.getOrDefault(storyId, new ArrayList<>()).removeIf(s -> s.principal().equals(principal));
        }

        @Override
        public Map<String, List<StoryShare>> listSharesFor(List<String> storyIds) {
            Map<String, List<StoryShare>> out = new LinkedHashMap<>();
            for (String id : storyIds) {
                List<StoryShare> list = shares.getOrDefault(id, List.of());
                if (!list.isEmpty()) {
                    out.put(id, List.copyOf(list));
                }
            }
            return out;
        }

        private Stream<Story> live(String tenantCode) {
            return rows.values().stream()
                    .filter(s -> Objects.equals(s.tenantCode(), tenantCode))
                    .filter(s -> !deleted.contains(s.id()));
        }

        private Story put(Story story) {
            rows.put(story.id(), story);
            return story;
        }

        /** ILIKE with {@code \} as the escape character, as the SQL uses it. */
        private static boolean matches(Story s, String kind, String titlePattern) {
            if (kind != null && !kind.equals(s.kind())) {
                return false;
            }
            if (titlePattern == null) {
                return true;
            }
            StringBuilder regex = new StringBuilder("(?is)");
            for (int i = 0; i < titlePattern.length(); i++) {
                char c = titlePattern.charAt(i);
                if (c == '\\' && i + 1 < titlePattern.length()) {
                    regex.append(Pattern.quote(String.valueOf(titlePattern.charAt(++i))));
                } else if (c == '%') {
                    regex.append(".*");
                } else if (c == '_') {
                    regex.append('.');
                } else {
                    regex.append(Pattern.quote(String.valueOf(c)));
                }
            }
            return s.title().matches(regex.toString());
        }

        private static StoryVersion stamped(StoryVersion v, String label) {
            return new StoryVersion(v.id(), v.storyId(), v.parentId(), label, v.summary(), v.contentType(),
                    v.content(), v.metadata(), OffsetDateTime.now(), v.createdBy());
        }
    }

    public static final class Links extends ShareLinkRepository {
        public final Map<String, ShareLink> rows = new LinkedHashMap<>();
        public final Set<String> revoked = new HashSet<>();
        /** Makes the next listing miss the active link, as a request racing another one would. */
        public boolean missNextListing;

        @Override
        public ShareLink insert(ShareLink link) {
            if (!listActive(link.tenantCode(), link.targetType(), link.targetId()).isEmpty()) {
                return null;
            }
            ShareLink saved = new ShareLink(link.token(), link.tenantCode(), link.targetType(), link.targetId(),
                    link.access(), link.createdBy(), OffsetDateTime.now());
            rows.put(saved.token(), saved);
            return saved;
        }

        @Override
        public ShareLink findActive(String token, String tenantCode) {
            ShareLink link = rows.get(token);
            return link != null && link.tenantCode().equals(tenantCode) && !revoked.contains(token) ? link : null;
        }

        @Override
        public List<ShareLink> listActive(String tenantCode, String targetType, String targetId) {
            if (missNextListing) {
                missNextListing = false;
                return List.of();
            }
            return rows.values().stream()
                    .filter(l -> l.tenantCode().equals(tenantCode) && l.targetType().equals(targetType)
                            && l.targetId().equals(targetId) && !revoked.contains(l.token()))
                    .toList();
        }

        @Override
        public boolean revoke(String token, String tenantCode) {
            return findActive(token, tenantCode) != null && revoked.add(token);
        }
    }

    public static final class Threads extends HarnessThreadRepository {
        public final Map<String, HarnessThread> rows = new LinkedHashMap<>();
        public final Map<String, List<HarnessThreadMessage>> messages = new LinkedHashMap<>();

        Threads() {
            super(null);
        }

        public HarnessThread add(String id, String tenantCode, String ownerId, String title) {
            OffsetDateTime now = OffsetDateTime.now();
            HarnessThread thread = new HarnessThread(id, tenantCode, ownerId, title, null, null, null, now, now, now);
            rows.put(id, thread);
            return thread;
        }

        public void addMessage(String threadId, String messageId) {
            List<HarnessThreadMessage> list = messages.computeIfAbsent(threadId, k -> new ArrayList<>());
            list.add(new HarnessThreadMessage(threadId, messageId, null, "aui-v1", Map.of("role", "user"),
                    list.size() + 1L, OffsetDateTime.now()));
        }

        @Override
        public HarnessThread find(String threadId, String tenantCode) {
            HarnessThread thread = rows.get(threadId);
            return thread != null && thread.tenantCode().equals(tenantCode) ? thread : null;
        }

        @Override
        public List<HarnessThreadMessage> listMessages(String threadId, long afterSeq, int limit) {
            return messages.getOrDefault(threadId, List.of()).stream()
                    .filter(m -> m.seq() > afterSeq).limit(limit).toList();
        }
    }
}
