package com.microboxlabs.miot.resource.sync;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(name = "rd_sync_cursors", schema = "miot_resource",
       uniqueConstraints = @UniqueConstraint(columnNames = {"client_id", "source_system", "entity_type"}))
public class SyncCursor extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Integer id;

    @Column(name = "client_id", nullable = false)
    public String clientId;

    @Column(name = "source_system", nullable = false)
    public String sourceSystem;

    @Column(name = "entity_type", nullable = false)
    public String entityType;

    @Column(name = "cursor_type", nullable = false)
    public String cursorType;

    @Column(name = "cursor_value", nullable = false)
    public String cursorValue;

    @Column(name = "last_sync_at", nullable = false)
    public Instant lastSyncAt;

    @Column(name = "entities_synced")
    public Integer entitiesSynced;

    @Column(name = "errors_last_sync")
    public Integer errorsLastSync = 0;
}
