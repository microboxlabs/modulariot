package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.Story;
import com.microboxlabs.miot.integrations.domain.StoryShare;
import com.microboxlabs.miot.integrations.domain.StoryVersion;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Storage for stories, their versions and their shares. Every read of a story
 * is scoped by {@code tenant_code} and hides soft-deleted rows in the SQL.
 * Access by owner or share is decided by the service.
 */
@ApplicationScoped
public class StoryRepository extends BoundedPgRepository {

    /** One story with the permission a share grants the caller. */
    public record SharedStory(Story story, String permission) {
    }

    private static final String CREATED_AT = "created_at";
    private static final String CREATED_BY = "created_by";

    private static final String STORY_COLUMNS = "id, tenant_code, owner_id, title, description, kind,"
            + " source_thread_id, source_message_id, current_version_id, created_at, created_by,"
            + " updated_at, updated_by";

    private static final String VERSION_COLUMNS =
            "id, story_id, parent_id, label, summary, content_type, content, metadata, created_at, created_by";

    private static final String VERSION_HEADER_COLUMNS = "id, story_id, parent_id, label, summary, content_type,"
            + " NULL::text AS content, NULL::jsonb AS metadata, created_at, created_by";

    private static final String FILTERS = "AND ($3::varchar IS NULL OR s.kind = $3)"
            + " AND ($4::text IS NULL OR s.title ILIKE $4 ESCAPE '\\')";

    // The story and its first version in one statement, so neither can exist
    // without the other.
    private static final String CREATE_STORY = """
            WITH s AS (
                INSERT INTO miot_integrations.story (
                    id, tenant_code, owner_id, title, description, kind, source_thread_id,
                    source_message_id, current_version_id, created_by, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $3, $3)
                RETURNING %s
            ), v AS (
                INSERT INTO miot_integrations.story_version (
                    id, story_id, label, summary, content_type, content, metadata, created_by
                )
                SELECT $9, s.id, COALESCE($10, 'v1'), $11, $12, $13, $14, $3 FROM s
            )
            SELECT %s FROM s""".formatted(STORY_COLUMNS, STORY_COLUMNS);

    private static final String LIST_OWNED = """
            SELECT %s
            FROM miot_integrations.story s
            WHERE s.tenant_code = $1 AND s.owner_id = $2 AND s.deleted_at IS NULL
              %s
            ORDER BY s.updated_at DESC
            LIMIT $5""".formatted(STORY_COLUMNS, FILTERS);

    private static final String LIST_SHARED_WITH = """
            SELECT s.id, s.tenant_code, s.owner_id, s.title, s.description, s.kind, s.source_thread_id,
                   s.source_message_id, s.current_version_id, s.created_at, s.created_by, s.updated_at,
                   s.updated_by, sh.permission AS share_permission
            FROM miot_integrations.story s
            JOIN miot_integrations.story_share sh ON sh.story_id = s.id
            WHERE s.tenant_code = $1 AND sh.principal = $2 AND s.deleted_at IS NULL
              %s
            ORDER BY s.updated_at DESC
            LIMIT $5""".formatted(FILTERS);

    private static final String FIND_STORY = """
            SELECT %s
            FROM miot_integrations.story
            WHERE id = $1 AND tenant_code = $2 AND deleted_at IS NULL""".formatted(STORY_COLUMNS);

    private static final String UPDATE_STORY = """
            UPDATE miot_integrations.story
            SET title = COALESCE($3, title),
                description = CASE WHEN $5 THEN NULL ELSE COALESCE($4, description) END,
                updated_at = now(),
                updated_by = $6
            WHERE id = $1 AND tenant_code = $2 AND deleted_at IS NULL
            RETURNING %s""".formatted(STORY_COLUMNS);

    private static final String SOFT_DELETE_STORY = """
            UPDATE miot_integrations.story
            SET deleted_at = now(), updated_at = now()
            WHERE id = $1 AND tenant_code = $2 AND owner_id = $3 AND deleted_at IS NULL""";

    // Adding a version makes it current, in the same statement.
    private static final String ADD_VERSION = """
            WITH live AS (
                SELECT id FROM miot_integrations.story
                WHERE id = $2 AND tenant_code = $3 AND deleted_at IS NULL
            ), v AS (
                INSERT INTO miot_integrations.story_version (
                    id, story_id, parent_id, label, summary, content_type, content, metadata, created_by
                )
                SELECT $1, live.id, $4,
                       COALESCE($5, 'v' || ((SELECT count(*) FROM miot_integrations.story_version
                                             WHERE story_id = $2) + 1)),
                       $6, $7, $8, $9, $10
                FROM live
                RETURNING %s
            ), touched AS (
                UPDATE miot_integrations.story
                SET current_version_id = $1, updated_at = now(), updated_by = $10
                WHERE id = $2 AND EXISTS (SELECT 1 FROM v)
            )
            SELECT %s FROM v""".formatted(VERSION_COLUMNS, VERSION_COLUMNS);

    private static final String SET_CURRENT = """
            UPDATE miot_integrations.story s
            SET current_version_id = $3, updated_at = now(), updated_by = $4
            WHERE s.id = $1 AND s.tenant_code = $2 AND s.deleted_at IS NULL
              AND EXISTS (SELECT 1 FROM miot_integrations.story_version v
                          WHERE v.id = $3 AND v.story_id = s.id)
            RETURNING %s""".formatted(STORY_COLUMNS);

    private static final String LIST_VERSIONS = """
            SELECT %s
            FROM miot_integrations.story_version
            WHERE story_id = $1
            ORDER BY created_at, id
            LIMIT $2""".formatted(VERSION_HEADER_COLUMNS);

    private static final String FIND_VERSION = """
            SELECT %s
            FROM miot_integrations.story_version
            WHERE id = $1 AND story_id = $2""".formatted(VERSION_COLUMNS);

    private static final String UPSERT_SHARE = """
            INSERT INTO miot_integrations.story_share (story_id, principal, permission, created_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (story_id, principal) DO UPDATE
                SET permission = EXCLUDED.permission
            RETURNING story_id, principal, permission, created_by, created_at""";

    private static final String DELETE_SHARE = """
            DELETE FROM miot_integrations.story_share
            WHERE story_id = $1 AND principal = $2""";

    private static final String LIST_SHARES_FOR = """
            SELECT story_id, principal, permission, created_by, created_at
            FROM miot_integrations.story_share
            WHERE story_id = ANY($1)
            ORDER BY story_id, principal""";

    @Inject
    public StoryRepository(
            Instance<Pool> clientInstance,
            @ConfigProperty(name = "miot.stories.query-timeout", defaultValue = "10s") Duration queryTimeout) {
        super(clientInstance, queryTimeout);
    }

    /** For unit tests, which subclass with no pool and never reach the wire. */
    protected StoryRepository() {
        super(null, DEFAULT_QUERY_TIMEOUT);
    }

    public Story create(Story story, StoryVersion first) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(story.id()))
                .addString(story.tenantCode())
                .addString(story.ownerId())
                .addString(story.title())
                .addString(story.description())
                .addString(story.kind())
                .addUUID(uuidOrNull(story.sourceThreadId()))
                .addString(story.sourceMessageId())
                .addUUID(UUID.fromString(first.id()))
                .addString(first.label())
                .addString(first.summary())
                .addString(first.contentType())
                .addString(first.content())
                .addJsonObject(toJson(first.metadata()));
        Row row = first(execute(CREATE_STORY, params));
        return row == null ? null : mapStory(row);
    }

    /** {@code titlePattern} is an ILIKE pattern, already escaped. */
    public List<Story> listOwned(String tenantCode, String ownerId, String kind, String titlePattern, int limit) {
        List<Story> out = new ArrayList<>();
        for (Row row : execute(LIST_OWNED, Tuple.of(tenantCode, ownerId, kind, titlePattern, limit))) {
            out.add(mapStory(row));
        }
        return out;
    }

    public List<SharedStory> listSharedWith(
            String tenantCode, String principal, String kind, String titlePattern, int limit) {
        List<SharedStory> out = new ArrayList<>();
        for (Row row : execute(LIST_SHARED_WITH, Tuple.of(tenantCode, principal, kind, titlePattern, limit))) {
            out.add(new SharedStory(mapStory(row), row.getString("share_permission")));
        }
        return out;
    }

    public Story find(String storyId, String tenantCode) {
        Row row = first(execute(FIND_STORY, Tuple.of(UUID.fromString(storyId), tenantCode)));
        return row == null ? null : mapStory(row);
    }

    public Story update(
            String storyId, String tenantCode, String title, String description, boolean clearDescription,
            String actor) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(storyId))
                .addString(tenantCode)
                .addString(title)
                .addString(description)
                .addBoolean(clearDescription)
                .addString(actor);
        Row row = first(execute(UPDATE_STORY, params));
        return row == null ? null : mapStory(row);
    }

    public boolean softDelete(String storyId, String tenantCode, String ownerId) {
        return execute(SOFT_DELETE_STORY, Tuple.of(UUID.fromString(storyId), tenantCode, ownerId)).rowCount() > 0;
    }

    /** Stores the version and makes it current. Null when the story is gone. */
    public StoryVersion addVersion(String tenantCode, StoryVersion version) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(version.id()))
                .addUUID(UUID.fromString(version.storyId()))
                .addString(tenantCode)
                .addUUID(uuidOrNull(version.parentId()))
                .addString(version.label())
                .addString(version.summary())
                .addString(version.contentType())
                .addString(version.content())
                .addJsonObject(toJson(version.metadata()))
                .addString(version.createdBy());
        Row row = first(execute(ADD_VERSION, params));
        return row == null ? null : mapVersion(row);
    }

    /** Null when the story is gone or the version is not one of its own. */
    public Story setCurrentVersion(String storyId, String tenantCode, String versionId, String actor) {
        Tuple params = Tuple.of(UUID.fromString(storyId), tenantCode, UUID.fromString(versionId), actor);
        Row row = first(execute(SET_CURRENT, params));
        return row == null ? null : mapStory(row);
    }

    /** The version tree without content, oldest first. */
    public List<StoryVersion> listVersions(String storyId, int limit) {
        List<StoryVersion> out = new ArrayList<>();
        for (Row row : execute(LIST_VERSIONS, Tuple.of(UUID.fromString(storyId), limit))) {
            out.add(mapVersion(row));
        }
        return out;
    }

    public StoryVersion findVersion(String storyId, String versionId) {
        Row row = first(execute(FIND_VERSION, Tuple.of(UUID.fromString(versionId), UUID.fromString(storyId))));
        return row == null ? null : mapVersion(row);
    }

    public StoryShare upsertShare(StoryShare share) {
        Tuple params = Tuple.of(
                UUID.fromString(share.storyId()), share.principal(), share.permission(), share.createdBy());
        Row row = first(execute(UPSERT_SHARE, params));
        return row == null ? null : mapShare(row);
    }

    public boolean deleteShare(String storyId, String principal) {
        return execute(DELETE_SHARE, Tuple.of(UUID.fromString(storyId), principal)).rowCount() > 0;
    }

    /** Shares for several stories at once, grouped by story id. */
    public Map<String, List<StoryShare>> listSharesFor(List<String> storyIds) {
        if (storyIds.isEmpty()) {
            return Map.of();
        }
        UUID[] ids = storyIds.stream().map(UUID::fromString).toArray(UUID[]::new);
        RowSet<Row> rows = execute(LIST_SHARES_FOR, Tuple.tuple().addArrayOfUUID(ids));
        Map<String, List<StoryShare>> out = new LinkedHashMap<>();
        for (Row row : rows) {
            StoryShare share = mapShare(row);
            out.computeIfAbsent(share.storyId(), key -> new ArrayList<>()).add(share);
        }
        return out;
    }

    public List<StoryShare> listShares(String storyId) {
        return listSharesFor(List.of(storyId)).getOrDefault(storyId, List.of());
    }

    private static UUID uuidOrNull(String value) {
        return value == null ? null : UUID.fromString(value);
    }

    private static String uuidString(Row row, String column) {
        UUID value = row.getUUID(column);
        return value == null ? null : value.toString();
    }

    private static Story mapStory(Row row) {
        return new Story(
                uuidString(row, "id"),
                row.getString("tenant_code"),
                row.getString("owner_id"),
                row.getString("title"),
                row.getString("description"),
                row.getString("kind"),
                uuidString(row, "source_thread_id"),
                row.getString("source_message_id"),
                uuidString(row, "current_version_id"),
                row.getOffsetDateTime(CREATED_AT),
                row.getString(CREATED_BY),
                row.getOffsetDateTime("updated_at"),
                row.getString("updated_by"));
    }

    private static StoryVersion mapVersion(Row row) {
        return new StoryVersion(
                uuidString(row, "id"),
                uuidString(row, "story_id"),
                uuidString(row, "parent_id"),
                row.getString("label"),
                row.getString("summary"),
                row.getString("content_type"),
                row.getString("content"),
                toMap(row.getJsonObject("metadata")),
                row.getOffsetDateTime(CREATED_AT),
                row.getString(CREATED_BY));
    }

    private static StoryShare mapShare(Row row) {
        return new StoryShare(
                uuidString(row, "story_id"),
                row.getString("principal"),
                row.getString("permission"),
                row.getString(CREATED_BY),
                row.getOffsetDateTime(CREATED_AT));
    }
}
