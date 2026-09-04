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
                        ? new DomainBrandingSummaryDto(domain, false, null, null)
                        : new DomainBrandingSummaryDto(
                                domain, true, metadata.logoEtag(), metadata.homeUrl())));
    }

    /** Unauthenticated. Null when the domain has no active branding. */
    public Uni<DomainBranding> findActiveLogo(String rawDomain) {
        String domain = DomainName.normalize(rawDomain);
        return Panache.withSession(() -> DomainBranding.findActiveByDomain(domain));
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
        String homeUrl = HomeUrl.normalize(request.homeUrl());
        boolean active = request.active() == null || request.active();

        return Panache.withTransaction(() -> DomainBranding.findByDomain(domain)
                .flatMap(existing -> {
                    DomainBranding branding = existing == null ? new DomainBranding() : existing;
                    branding.domain = domain;
                    branding.logoContent = logo.content();
                    branding.logoMime = logo.mime();
                    branding.logoEtag = logo.etag();
                    branding.homeUrl = homeUrl;
                    branding.active = active;
                    branding.updatedAt = Instant.now();
                    branding.updatedBy = callerEmail;
                    return branding.persistAndFlush().replaceWith(branding);
                })
                .map(DomainBrandingService::toDto));
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
                branding.homeUrl,
                branding.active,
                branding.updatedAt,
                branding.updatedBy);
    }
}
