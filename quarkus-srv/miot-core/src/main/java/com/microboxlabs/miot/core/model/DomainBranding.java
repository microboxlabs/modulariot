package com.microboxlabs.miot.core.model;

import com.microboxlabs.miot.core.api.dto.DomainBrandingDto;
import com.microboxlabs.miot.core.branding.DomainBrandingMetadata;
import com.microboxlabs.miot.core.branding.LogoImage;
import com.microboxlabs.miot.core.branding.LogoVariant;
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

    // The dark variant is optional: most domains ship one logo that reads on
    // both grounds, and a row without these columns serves the light one
    // everywhere. V0.1.7 keeps all three null or all three set.

    @Column(name = "logo_dark_content")
    public byte[] logoDarkContent;

    @Column(name = "logo_dark_mime")
    public String logoDarkMime;

    @Column(name = "logo_dark_etag")
    public String logoDarkEtag;

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

    /**
     * Sets or clears the dark variant, all three columns together.
     *
     * <p>V0.1.7 constrains them to be all set or all null, and this is where
     * that holds: a caller passing {@code null} means "no dark variant", not
     * "leave two of the columns as they were".
     */
    public void setDarkLogo(LogoImage logo) {
        logoDarkContent = logo == null ? null : logo.content();
        logoDarkMime = logo == null ? null : logo.mime();
        logoDarkEtag = logo == null ? null : logo.etag();
    }

    /**
     * The stored image for one ground, or {@code null} when this row has no
     * dark variant — in which case the caller falls back to the light one.
     *
     * <p>Returns a {@link LogoImage} because that is what these columns hold:
     * a decoded, validated logo, written by {@code LogoImage.fromDataUrl} and
     * read back unchanged.
     */
    public LogoImage logoFor(LogoVariant variant) {
        if (variant == LogoVariant.DARK) {
            return logoDarkContent == null
                    ? null
                    : new LogoImage(logoDarkMime, logoDarkContent, logoDarkEtag);
        }
        return new LogoImage(logoMime, logoContent, logoEtag);
    }

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
