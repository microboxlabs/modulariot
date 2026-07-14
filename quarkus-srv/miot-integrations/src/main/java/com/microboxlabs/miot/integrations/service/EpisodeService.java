package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.InteractionEpisode;
import com.microboxlabs.miot.integrations.dto.EpisodeRequest;
import com.microboxlabs.miot.integrations.persistence.InteractionEpisodeRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.Set;

/**
 * Records interaction episodes for the semantic-layer continual-learning loop.
 * Append-only: validate, inject tenant + user server-side, persist. Unlike
 * {@code AsyncJobService} there is no retry/claim/lifecycle — an episode is
 * written once and later read by the distiller. Validation throws
 * {@link IllegalArgumentException}, which the resource maps to HTTP 400.
 */
@ApplicationScoped
public class EpisodeService {

    private static final Set<String> SURFACES = Set.of("spotlight", "cli");

    private final InteractionEpisodeRepository repository;

    @Inject
    public EpisodeService(InteractionEpisodeRepository repository) {
        this.repository = repository;
    }

    public InteractionEpisode recordEpisode(String tenantCode, String userId, EpisodeRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("episode body is required");
        }
        String surface = request.surface();
        if (surface == null || surface.isBlank()) {
            throw new IllegalArgumentException("surface is required");
        }
        if (!SURFACES.contains(surface)) {
            throw new IllegalArgumentException("surface must be one of " + SURFACES);
        }
        return repository.insert(new InteractionEpisode(
                null,
                tenantCode,
                userId,
                surface,
                blankToNull(request.runId()),
                blankToNull(request.signal()),
                request.payload() == null ? Map.of() : request.payload(),
                null));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
