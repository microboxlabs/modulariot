package com.microboxlabs.miot.core.branding;

import com.microboxlabs.miot.core.api.dto.DomainBrandingDto;
import com.microboxlabs.miot.core.api.dto.DomainBrandingSummaryDto;
import com.microboxlabs.miot.core.api.dto.SetDomainBrandingRequest;
import com.microboxlabs.miot.core.model.DomainBranding;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.time.Instant;
import java.util.List;

/** Reads and writes {@link DomainBranding}. */
@ApplicationScoped
public class DomainBrandingService {

    /**
     * Unauthenticated. Answers for any well-formed domain; an unconfigured one
     * comes back with {@code hasLogo = false} rather than a 404.
     */
    public Uni<DomainBrandingSummaryDto> summary(String rawDomain) {
        String domain = DomainName.normalize(rawDomain);
        return Panache.withSession(() -> DomainBranding.findActiveMetadata(domain)
                .map(metadata -> metadata == null
                        ? new DomainBrandingSummaryDto(domain, false, null, false, null, null)
                        : new DomainBrandingSummaryDto(
                                domain,
                                true,
                                metadata.logoEtag(),
                                metadata.logoDarkEtag() != null,
                                metadata.logoDarkEtag(),
                                metadata.homeUrl())));
    }

    // One variant's three columns, not the row. Both blobs are eagerly fetched
    // basic fields, so loading the entity to serve one logo reads the other
    // with it — up to 512 KB from the database to write at most 256 KB, on the
    // request every visitor makes. Selected straight into LogoImage: that is
    // what these columns hold, and it already compares and prints its byte[]
    // correctly. Same reasoning as DomainBrandingMetadata above.

    private static final String SELECT_LOGO =
            "select new com.microboxlabs.miot.core.branding.LogoImage(%s, %s, %s)"
                    + " from DomainBranding where domain = :domain";

    private static final String ACTIVE_ONLY = " and active = true";

    /**
     * The null check is what makes an absent dark variant a missing row rather
     * than a {@link LogoImage} of three nulls.
     */
    private static final String DARK_ONLY = " and logoDarkContent is not null";

    private static String logoQuery(LogoVariant variant, boolean activeOnly) {
        String query = variant == LogoVariant.DARK
                ? SELECT_LOGO.formatted("logoDarkMime", "logoDarkContent", "logoDarkEtag")
                        + DARK_ONLY
                : SELECT_LOGO.formatted("logoMime", "logoContent", "logoEtag");
        return activeOnly ? query + ACTIVE_ONLY : query;
    }

    /**
     * Unauthenticated. Null when the domain has no active branding — or, for
     * the dark variant, when it ships one logo for both grounds.
     */
    public Uni<LogoImage> findActiveLogo(String rawDomain, LogoVariant variant) {
        return findLogo(rawDomain, variant, true);
    }

    /**
     * The stored image whether or not the domain is active.
     *
     * <p>Deactivating is meant to park a configuration, not lose it: the
     * settings UI still lists an inactive domain, previews it, and re-reads its
     * bytes when an edit changes only the home URL. Reading through the public
     * endpoint would 404 on all three and force a re-upload to reactivate.
     * Authorization is the caller's, checked by {@code PlatformBrandingResource}.
     */
    public Uni<LogoImage> findLogoForOwner(String rawDomain, LogoVariant variant) {
        return findLogo(rawDomain, variant, false);
    }

    private Uni<LogoImage> findLogo(
            String rawDomain, LogoVariant variant, boolean activeOnly) {
        String domain = DomainName.normalize(rawDomain);
        String query = logoQuery(variant, activeOnly);
        return Panache.withSession(() -> Panache.getSession()
                .flatMap(session -> session.createQuery(query, LogoImage.class)
                        .setParameter("domain", domain)
                        .getSingleResultOrNull()));
    }

    public Uni<List<DomainBrandingDto>> list() {
        return Panache.withSession(DomainBranding::listAllMetadata);
    }

    public Uni<DomainBrandingDto> get(String rawDomain) {
        String domain = DomainName.normalize(rawDomain);
        return Panache.withSession(() -> DomainBranding.findMetadataByDomain(domain)
                .map(dto -> {
                    if (dto == null) {
                        throw new NotFoundException("No branding for domain: " + domain);
                    }
                    return dto;
                }));
    }

    public Uni<DomainBrandingDto> upsert(
            String rawDomain, SetDomainBrandingRequest request, String callerEmail) {
        if (request == null) {
            throw new BadRequestException("Request body is required");
        }
        String domain = DomainName.normalize(rawDomain);
        LogoImage logo = LogoImage.fromDataUrl(request.logoDataUrl());
        LogoImage darkLogo = optionalLogo(request.logoDarkDataUrl());
        String homeUrl = HomeUrl.normalize(request.homeUrl());
        boolean active = request.active() == null || request.active();

        return Panache.withTransaction(() -> DomainBranding.findByDomain(domain)
                .flatMap(existing -> {
                    DomainBranding branding = existing == null ? new DomainBranding() : existing;
                    branding.domain = domain;
                    branding.logoContent = logo.content();
                    branding.logoMime = logo.mime();
                    branding.logoEtag = logo.etag();
                    branding.setDarkLogo(darkLogo);
                    branding.homeUrl = homeUrl;
                    branding.active = active;
                    branding.updatedAt = Instant.now();
                    branding.updatedBy = callerEmail;
                    return branding.persistAndFlush().replaceWith(branding);
                })
                .map(DomainBrandingService::toDto));
    }

    /**
     * Absent means absent: a PUT replaces the row, so omitting the dark logo
     * clears a stored one rather than keeping it.
     */
    private static LogoImage optionalLogo(String dataUrl) {
        return dataUrl == null || dataUrl.isBlank() ? null : LogoImage.fromDataUrl(dataUrl);
    }

    public Uni<Void> delete(String rawDomain) {
        String domain = DomainName.normalize(rawDomain);
        return Panache.withTransaction(() -> DomainBranding.findByDomain(domain)
                .flatMap(branding -> {
                    if (branding == null) {
                        throw new NotFoundException("No branding for domain: " + domain);
                    }
                    return branding.delete();
                }));
    }

    private static DomainBrandingDto toDto(DomainBranding branding) {
        return new DomainBrandingDto(
                branding.domain,
                branding.logoMime,
                branding.logoEtag,
                branding.logoDarkMime,
                branding.logoDarkEtag,
                branding.homeUrl,
                branding.active,
                branding.updatedAt,
                branding.updatedBy);
    }
}
