package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.HarnessThreadMessage;
import com.microboxlabs.miot.integrations.domain.StoryVersion;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Request and response shapes for stories and share links. */
public final class StoryDtos {

    private StoryDtos() {
    }

    /**
     * The content of a new version. {@code parentId} defaults to the story's
     * current version; {@code label} defaults to "v" and the version count;
     * {@code contentType} defaults from the story's kind. A PDF's content is
     * base64.
     */
    public record VersionInput(
            String parentId,
            String label,
            String summary,
            String contentType,
            String content,
            Map<String, Object> metadata) {
    }

    /** A new story and its first version. */
    public record CreateStoryRequest(
            String title,
            String description,
            String kind,
            String sourceThreadId,
            String sourceMessageId,
            VersionInput version) {
    }

    /** Fields left null keep their value; an empty description clears it. */
    public record PatchStoryRequest(
            String title,
            String description) {
    }

    public record SetCurrentVersionRequest(String versionId) {
    }

    /** {@code permission} is "read" (the default) or "write". */
    public record StoryShareRequest(
            String principal,
            String permission) {
    }

    public record ShareEntry(
            String principal,
            String permission) {
    }

    /**
     * A story as the caller sees it. {@code permission} is "owner", "write" or
     * "read". {@code sharedWith} is filled for the owner only.
     * {@code currentVersion}, with its content, is filled when reading one
     * story and left null in listings and after writes.
     */
    public record StoryResponse(
            String id,
            String title,
            String description,
            String kind,
            String ownerId,
            boolean owned,
            String permission,
            String sourceThreadId,
            String sourceMessageId,
            String currentVersionId,
            OffsetDateTime createdAt,
            String createdBy,
            OffsetDateTime updatedAt,
            String updatedBy,
            List<ShareEntry> sharedWith,
            StoryVersion currentVersion) {
    }

    /** {@code targetType} is "story" or "thread". */
    public record CreateLinkRequest(
            String targetType,
            String targetId) {
    }

    /** {@code path} is the API path that resolves the link. */
    public record LinkResponse(
            String token,
            String targetType,
            String targetId,
            String access,
            String createdBy,
            OffsetDateTime createdAt,
            String path) {
    }

    /**
     * What a link opens: a story with its current version, or a thread with
     * one page of its messages. The fields of the other target type are null.
     */
    public record LinkSnapshot(
            String targetType,
            StoryResponse story,
            StoryVersion version,
            ThreadResponse thread,
            List<HarnessThreadMessage> messages) {
    }
}
