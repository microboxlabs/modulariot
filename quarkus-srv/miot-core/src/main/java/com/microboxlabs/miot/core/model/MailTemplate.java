package com.microboxlabs.miot.core.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** A Handlebars email template. {@code organizationId} null is the platform's template. */
@Entity
@Table(name = "mail_template", schema = "miot_core")
public class MailTemplate extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "organization_id")
    public Long organizationId;

    @Column(nullable = false)
    public String kind;

    @Column(nullable = false)
    public String lang;

    @Column(nullable = false)
    public String subject;

    @Column(nullable = false)
    public String html;

    @Column(name = "updated_by")
    public String updatedBy;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt = Instant.now();

    /** The organization's template, or the platform's when {@code organizationId} is null. */
    public static Uni<MailTemplate> findFor(Long organizationId, String kind, String lang) {
        return organizationId == null
                ? find("organizationId is null and kind = ?1 and lang = ?2", kind, lang).firstResult()
                : find("organizationId = ?1 and kind = ?2 and lang = ?3", organizationId, kind, lang)
                        .firstResult();
    }
}
