package com.microboxlabs.miot.integrations.mcp;

import com.microboxlabs.miot.core.mcp.McpCaller;
import com.microboxlabs.miot.integrations.domain.ShareLink;
import com.microboxlabs.miot.integrations.domain.StoryVersion;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateLinkRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.LinkResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.VersionInput;
import com.microboxlabs.miot.integrations.service.ShareLinkService;
import com.microboxlabs.miot.integrations.service.StoryService;
import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolCallException;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.function.Supplier;

/**
 * Stories as MCP tools: the operations of {@code /api/v1/orgs/{org}/stories}
 * under the same rules, acting as the caller. A story is private to whoever
 * creates it until they share it.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class StoryTools {

    static final String ORGANIZATION = "The organization's slug, as in /api/v1/orgs/{slug}.";
    static final String STORY_ID = "The story's id (a UUID).";
    static final String VERSION = "The version's content. content: the document itself (Markdown, HTML or"
            + " SVG source, or a PDF as base64). metadata: structured content as a JSON object, e.g. a deck's"
            + " {\"slides\": [{\"type\": \"title\", \"title\": \"...\"}]}. Give content, metadata or both."
            + " Optional: label (a short name such as \"Draft\"; defaults to v<n>), summary (what changed, in"
            + " a sentence), contentType (defaults from the kind), parentId (the version this one derives"
            + " from; defaults to the current one).";

    public record Stories(List<StoryResponse> stories) {
    }

    /** A story, the version asked for (current by default) and the version tree without content. */
    public record StoryView(StoryResponse story, StoryVersion version, List<StoryVersion> versions) {
    }

    private final McpCaller caller;
    private final StoryService stories;
    private final ShareLinkService links;

    @Inject
    public StoryTools(McpCaller caller, StoryService stories, ShareLinkService links) {
        this.caller = caller;
        this.stories = stories;
        this.links = links;
    }

    @Tool(name = "stories_list", structuredContent = true,
            description = "The caller's stories (saved reports, decks, charts and documents) and the ones"
                    + " shared with them, most recently updated first. Content is not included; use"
                    + " stories_get for that.",
            annotations = @Tool.Annotations(title = "List stories", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Stories> list(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = "Only stories of this kind: markdown, html, svg, deck, pdf or sections.",
                    required = false) String kind,
            @ToolArg(description = "Text to look for in the title.", required = false) String search,
            @ToolArg(description = "At most this many stories; 100 when not given.", required = false)
            Integer limit) {
        return caller.member(organization).flatMap(in -> work(() ->
                new Stories(stories.list(in.tenantCode(), in.actor(), kind, search, limit))));
    }

    @Tool(name = "stories_get", structuredContent = true,
            description = "One story with the content of its current version (or of versionId), and the list"
                    + " of all its versions without content.",
            annotations = @Tool.Annotations(title = "Get a story", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<StoryView> get(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = STORY_ID) String storyId,
            @ToolArg(description = "A version to read instead of the current one.", required = false)
            String versionId) {
        return caller.member(organization).flatMap(in -> work(() -> {
            StoryResponse story = found(stories.get(in.tenantCode(), in.actor(), storyId), storyId);
            StoryVersion version = versionId == null || versionId.isBlank()
                    ? story.currentVersion()
                    : found(stories.getVersion(in.tenantCode(), in.actor(), storyId, versionId), storyId);
            List<StoryVersion> versions = stories.listVersions(in.tenantCode(), in.actor(), storyId)
                    .orElse(List.of());
            return new StoryView(story, version, versions);
        }));
    }

    @Tool(name = "stories_create", structuredContent = true,
            description = "Saves a document as a new story the caller owns, with its first version. Use it"
                    + " when the user wants to keep or share a result: a report, a chart as SVG, a deck.",
            annotations = @Tool.Annotations(title = "Create a story", readOnlyHint = false,
                    destructiveHint = false, idempotentHint = false, openWorldHint = false))
    public Uni<StoryResponse> create(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = "A short title for the story.") String title,
            @ToolArg(description = "markdown, html, svg, deck, pdf or sections.") String kind,
            @ToolArg(description = VERSION) VersionInput version,
            @ToolArg(description = "One or two sentences on what the story is about.", required = false)
            String description,
            @ToolArg(description = "The chat thread the story came from, if any.", required = false)
            String sourceThreadId,
            @ToolArg(description = "The chat message the story came from, if any.", required = false)
            String sourceMessageId) {
        CreateStoryRequest request = new CreateStoryRequest(title, description, kind, sourceThreadId,
                sourceMessageId, version);
        return caller.member(organization).flatMap(in -> work(() ->
                found(stories.create(in.tenantCode(), in.actor(), request), null)));
    }

    @Tool(name = "stories_add_version", structuredContent = true,
            description = "Saves a new version of a story and makes it the current one. The previous versions"
                    + " stay. Needs the owner or a write share. Returns the version without its content.",
            annotations = @Tool.Annotations(title = "Add a story version", readOnlyHint = false,
                    destructiveHint = false, idempotentHint = false, openWorldHint = false))
    public Uni<StoryVersion> addVersion(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = STORY_ID) String storyId,
            @ToolArg(description = VERSION) VersionInput version) {
        return caller.member(organization).flatMap(in -> work(() -> {
            StoryVersion saved = found(stories.addVersion(in.tenantCode(), in.actor(), storyId, version), storyId);
            return new StoryVersion(saved.id(), saved.storyId(), saved.parentId(), saved.label(),
                    saved.summary(), saved.contentType(), null, null, saved.createdAt(), saved.createdBy());
        }));
    }

    @Tool(name = "stories_set_current", structuredContent = true,
            description = "Makes an existing version the one a story shows, e.g. to go back to an earlier"
                    + " draft. Needs the owner or a write share.",
            annotations = @Tool.Annotations(title = "Set a story's current version", readOnlyHint = false,
                    destructiveHint = false, idempotentHint = true, openWorldHint = false))
    public Uni<StoryResponse> setCurrent(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = STORY_ID) String storyId,
            @ToolArg(description = "The version to show (a UUID from stories_get).") String versionId) {
        return caller.member(organization).flatMap(in -> work(() ->
                found(stories.setCurrentVersion(in.tenantCode(), in.actor(), storyId, versionId), storyId)));
    }

    @Tool(name = "stories_link", structuredContent = true,
            description = "A link any member of the organization can open to read the story's current"
                    + " version. Returns the story's existing link when it has one. Only the owner can make it.",
            annotations = @Tool.Annotations(title = "Get a story's share link", readOnlyHint = false,
                    destructiveHint = false, idempotentHint = true, openWorldHint = false))
    public Uni<LinkResponse> link(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = STORY_ID) String storyId) {
        return caller.member(organization).flatMap(in -> work(() -> found(
                links.create(organization, in.tenantCode(), in.actor(),
                        new CreateLinkRequest(ShareLink.STORY, storyId)),
                storyId)));
    }

    private static <T> T found(T value, String storyId) {
        if (value == null) {
            throw new NoSuchElementException(storyId == null ? "story not saved" : "story not found: " + storyId);
        }
        return value;
    }

    private static <T> Uni<T> work(Supplier<T> call) {
        return Uni.createFrom().item(() -> guarded(call))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    static <T> T guarded(Supplier<T> call) {
        try {
            return call.get();
        } catch (IllegalArgumentException | NoSuchElementException e) {
            throw new ToolCallException(e.getMessage(), e);
        }
    }
}
