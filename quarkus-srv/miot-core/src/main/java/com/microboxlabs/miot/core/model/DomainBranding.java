package com.microboxlabs.miot.core.model;

import com.microboxlabs.miot.core.api.dto.DomainBrandingDto;
import com.microboxlabs.miot.core.branding.DomainBrandingMetadata;
import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;

/**
 * Branding applied to every request arriving on a given host.
 *
 * <p>The key is the domain, not the organization: a single deployment can be
 * reached on several hosts and the sign-in page has to pick a logo before any
 * user — and therefore any organization — is known.
 */
@Entity
@Table(name = "domain_branding", schema = "miot_core")
public class DomainBranding extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, unique = true)
    public String domain;

    @Column(name = "logo_content", nullable = false)
    public byte[] logoContent;

    @Column(name = "logo_mime", nullable = false)
    public String logoMime;

    @Column(name = "logo_etag", nullable = false)
    public String logoEtag;

    @Column(name = "home_url")
    public String homeUrl;

    @Column(nullable = false)
    public boolean active = true;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt = Instant.now();

    @Column(name = "updated_by")
    public String updatedBy;

    public static Uni<DomainBranding> findByDomain(String domain) {
        return find("domain = ?1", domain).firstResult();
    }

    /** Loads the row with its bytes; only the endpoint serving the image needs this. */
    public static Uni<DomainBranding> findActiveByDomain(String domain) {
        return find("domain = ?1 and active = true", domain).firstResult();
    }

    // The projecting finders below leave logo_content in the database. It is an
    // eagerly fetched basic column, so any query returning the entity reads up to
    // 256 KB per row even when the caller only wants the metadata.

    public static Uni<DomainBrandingMetadata> findActiveMetadata(String domain) {
        return find("domain = ?1 and active = true", domain)
                .project(DomainBrandingMetadata.class)
                .firstResult();
    }

    public static Uni<DomainBrandingDto> findMetadataByDomain(String domain) {
        return find("domain = ?1", domain)
                .project(DomainBrandingDto.class)
                .firstResult();
    }

    public static Uni<List<DomainBrandingDto>> listAllMetadata() {
        return find("order by domain").project(DomainBrandingDto.class).list();
    }
}
