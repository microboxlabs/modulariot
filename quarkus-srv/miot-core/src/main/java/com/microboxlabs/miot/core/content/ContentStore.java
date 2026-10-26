package com.microboxlabs.miot.core.content;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The {@code miot_core.content} rows. */
public interface ContentStore {

    Content insert(Content content);

    Optional<Content> find(String tenantCode, UUID id);

    /** Sets or clears ({@code owner} null) the record that uses the content; false when there is no such row. */
    boolean owner(String tenantCode, UUID id, String owner);

    /** Locks at most {@code limit} unowned rows until the caller's transaction ends. */
    List<Content> unowned(OffsetDateTime before, int limit);

    /** Removes a locked candidate only while it remains unowned and older than {@code before}. */
    boolean deleteUnowned(String tenantCode, UUID id, OffsetDateTime before);
}
