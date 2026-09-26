package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ModelProvider;
import com.microboxlabs.miot.integrations.dto.ModelUsageDtos.RecordUsageRequest;
import com.microboxlabs.miot.integrations.dto.ModelUsageDtos.UsageLine;
import com.microboxlabs.miot.integrations.dto.ModelUsageDtos.UsageTotal;
import com.microboxlabs.miot.integrations.persistence.ModelProviderRepository;
import com.microboxlabs.miot.integrations.persistence.ModelUsageRepository;
import com.microboxlabs.miot.integrations.persistence.ModelUsageRepository.UsageRow;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Records the tokens each harness run used and prices them with the model
 * prices in force at that moment.
 *
 * <p>All input tokens, cached or not, are charged at the model's input price.
 * Output tokens are charged at its output price. A model without both prices is
 * recorded with no cost.
 *
 * <p>Validation throws {@link IllegalArgumentException}, which the resources map to 400.
 */
@ApplicationScoped
public class ModelUsageService {

    private static final BigDecimal MILLION = BigDecimal.valueOf(1_000_000);

    private final ModelUsageRepository usage;
    private final ModelProviderRepository providers;

    @Inject
    public ModelUsageService(ModelUsageRepository usage, ModelProviderRepository providers) {
        this.usage = usage;
        this.providers = providers;
    }

    /** Returns how many lines were stored; lines the run already reported are skipped. */
    public int record(RecordUsageRequest req) {
        if (req == null || blank(req.runId()) || blank(req.tenantId())) {
            throw new IllegalArgumentException("runId and tenantId are required");
        }
        Map<String, ModelProvider.Model> prices = prices();
        int stored = 0;
        for (UsageLine line : req.usage() == null ? List.<UsageLine>of() : req.usage()) {
            if (line == null || blank(line.provider()) || blank(line.model())) {
                throw new IllegalArgumentException("every usage line needs a provider and a model");
            }
            if (line.calls() < 0 || line.inputTokens() < 0 || line.outputTokens() < 0
                    || line.cacheReadTokens() < 0 || line.cacheWriteTokens() < 0) {
                throw new IllegalArgumentException("token counts cannot be negative");
            }
            ModelProvider.Model price = prices.get(key(line.provider(), line.model()));
            BigDecimal in = price == null ? null : price.inputPerMtok();
            BigDecimal out = price == null ? null : price.outputPerMtok();
            if (usage.insert(new UsageRow(
                    req.runId(), req.organization(), req.tenantId(), req.userId(),
                    line.provider(), line.model(), line.calls(),
                    line.inputTokens(), line.outputTokens(),
                    line.cacheReadTokens(), line.cacheWriteTokens(),
                    in, out, cost(line, in, out)))) {
                stored++;
            }
        }
        return stored;
    }

    public List<UsageTotal> totals(OffsetDateTime from, OffsetDateTime to, String organization) {
        if (from == null || to == null || !from.isBefore(to)) {
            throw new IllegalArgumentException("from must be before to");
        }
        return usage.totals(from, to, blank(organization) ? null : organization);
    }

    static BigDecimal cost(UsageLine line, BigDecimal inputPerMtok, BigDecimal outputPerMtok) {
        if (inputPerMtok == null || outputPerMtok == null) {
            return null;
        }
        long input = line.inputTokens() + line.cacheReadTokens() + line.cacheWriteTokens();
        return BigDecimal.valueOf(input).multiply(inputPerMtok)
                .add(BigDecimal.valueOf(line.outputTokens()).multiply(outputPerMtok))
                .divide(MILLION, 8, RoundingMode.HALF_UP);
    }

    private Map<String, ModelProvider.Model> prices() {
        Map<String, ModelProvider.Model> out = new HashMap<>();
        for (ModelProvider p : providers.list()) {
            for (ModelProvider.Model m : p.models()) {
                out.put(key(p.provider(), m.id()), m);
            }
        }
        return out;
    }

    private static String key(String provider, String model) {
        return provider + "\u0000" + model;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
