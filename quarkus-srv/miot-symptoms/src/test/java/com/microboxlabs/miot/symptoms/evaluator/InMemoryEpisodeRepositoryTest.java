package com.microboxlabs.miot.symptoms.evaluator;

import org.junit.jupiter.api.Test;

class InMemoryEpisodeRepositoryTest {

    @Test
    void forgettingACaseDropsItsEpisodeAndPreservesTheWatermark() {
        EpisodeRepository repository = new InMemoryEpisodeRepository();
        RedisEpisodesTest.assertForgotten(repository, repository);
    }
}
