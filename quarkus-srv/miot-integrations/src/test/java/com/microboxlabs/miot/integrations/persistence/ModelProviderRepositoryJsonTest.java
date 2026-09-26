package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.integrations.domain.ModelProvider;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ModelProviderRepositoryJsonTest {

    @Test
    void modelsSurviveTheJsonColumnWithExactPrices() {
        List<ModelProvider.Model> models = List.of(
                new ModelProvider.Model("deepseek-chat", new BigDecimal("0.27"), new BigDecimal("1.10"), true),
                new ModelProvider.Model("deepseek-reasoner", null, null, false));

        List<ModelProvider.Model> back = ModelProviderRepository.fromJson(ModelProviderRepository.toJson(models));

        assertEquals(models, back);
    }

    @Test
    void aMissingColumnReadsAsNoModels() {
        assertEquals(List.of(), ModelProviderRepository.fromJson(null));
    }
}
