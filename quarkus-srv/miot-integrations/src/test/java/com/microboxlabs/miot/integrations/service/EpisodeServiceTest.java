package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.domain.InteractionEpisode;
import com.microboxlabs.miot.integrations.dto.EpisodeRequest;
import com.microboxlabs.miot.integrations.persistence.InteractionEpisodeRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EpisodeServiceTest {

    @Test
    void recordRejectsMissingOrUnknownSurface() {
        var service = new EpisodeService(new FakeRepository());
        var nullSurface = new EpisodeRequest(null, null, null, null);
        var blankSurface = new EpisodeRequest("  ", null, null, null);
        var unknownSurface = new EpisodeRequest("email", null, null, null);
        assertThrows(IllegalArgumentException.class,
                () -> service.recordEpisode("t", "u", nullSurface));
        assertThrows(IllegalArgumentException.class,
                () -> service.recordEpisode("t", "u", blankSurface));
        assertThrows(IllegalArgumentException.class,
                () -> service.recordEpisode("t", "u", unknownSurface));
    }

    @Test
    void recordRejectsNullBody() {
        var service = new EpisodeService(new FakeRepository());
        assertThrows(IllegalArgumentException.class, () -> service.recordEpisode("t", "u", null));
    }

    @Test
    void recordInjectsTenantAndUserAndDefaultsPayload() {
        var repo = new FakeRepository();
        var service = new EpisodeService(repo);

        var saved = service.recordEpisode("tenant-1", "user-1",
                new EpisodeRequest("spotlight", "run-9", "clicked", null));

        assertNotNull(saved);
        assertEquals("tenant-1", repo.inserted.tenantCode());
        assertEquals("user-1", repo.inserted.userId());
        assertEquals("spotlight", repo.inserted.surface());
        assertEquals("run-9", repo.inserted.runId());
        assertEquals("clicked", repo.inserted.signal());
        assertEquals(Map.of(), repo.inserted.payload()); // null payload -> empty map
    }

    @Test
    void recordBlanksOptionalStringsToNull() {
        var repo = new FakeRepository();
        var service = new EpisodeService(repo);

        service.recordEpisode("t", "u", new EpisodeRequest("cli", "  ", "  ", Map.of("fact", "x")));

        assertNull(repo.inserted.runId());
        assertNull(repo.inserted.signal());
        assertEquals(Map.of("fact", "x"), repo.inserted.payload());
    }

    /** Repository stub capturing the episode the service built (null pool, no DB). */
    private static class FakeRepository extends InteractionEpisodeRepository {
        InteractionEpisode inserted;

        FakeRepository() {
            super(null);
        }

        @Override
        public InteractionEpisode insert(InteractionEpisode episode) {
            this.inserted = episode;
            return episode;
        }
    }
}
