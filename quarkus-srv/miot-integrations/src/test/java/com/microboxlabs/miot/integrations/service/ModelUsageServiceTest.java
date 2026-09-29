package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.domain.ModelProvider;
import com.microboxlabs.miot.integrations.dto.ModelUsageDtos.RecordUsageRequest;
import com.microboxlabs.miot.integrations.dto.ModelUsageDtos.UsageLine;
import com.microboxlabs.miot.integrations.persistence.ModelProviderRepository;
import com.microboxlabs.miot.integrations.persistence.ModelUsageRepository;
import com.microboxlabs.miot.integrations.persistence.ModelUsageRepository.UsageRow;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ModelUsageServiceTest {

    static final class Providers extends ModelProviderRepository {
        final List<ModelProvider> rows = new ArrayList<>();

        Providers() {
            super(null);
        }

        @Override
        public List<ModelProvider> list() {
            return rows;
        }
    }

    static final class Usage extends ModelUsageRepository {
        final List<UsageRow> rows = new ArrayList<>();
        final Set<String> seen = new HashSet<>();

        Usage() {
            super(null);
        }

        @Override
        public boolean insert(UsageRow r) {
            if (!seen.add(r.runId() + "/" + r.provider() + "/" + r.model())) {
                return false;
            }
            rows.add(r);
            return true;
        }
    }

    private final Providers providers = new Providers();
    private final Usage usage = new Usage();
    private final ModelUsageService service = new ModelUsageService(usage, providers);

    private void price(String provider, String model, String in, String out) {
        price(provider, model, in, out, null);
    }

    private void price(String provider, String model, String in, String out, String multiplier) {
        providers.rows.add(new ModelProvider(provider, null, "enc", "…1234",
                List.of(new ModelProvider.Model(model,
                        in == null ? null : new BigDecimal(in),
                        out == null ? null : new BigDecimal(out), false,
                        multiplier == null ? null : new BigDecimal(multiplier))),
                true, "owner", null));
    }

    private static RecordUsageRequest run(String runId, UsageLine... lines) {
        return new RecordUsageRequest(runId, "acme", "tenant-1", "alice", List.of(lines));
    }

    @Test
    void cachedInputIsChargedAtTheInputPriceAndPricesAreCopied() {
        price("deepseek", "deepseek-chat", "0.27", "1.10");

        service.recordUsage(run("r1", new UsageLine("deepseek", "deepseek-chat", 2, 600_000, 100_000, 300_000, 100_000)));

        UsageRow row = usage.rows.get(0);
        // (600k + 300k + 100k) * 0.27 / 1M + 100k * 1.10 / 1M = 0.27 + 0.11
        assertEquals(new BigDecimal("0.38000000"), row.costUsd());
        assertEquals(new BigDecimal("0.27"), row.inputPerMtok());
        assertEquals("acme", row.organization());
    }

    @Test
    void poolTokensAreEveryTokenTimesTheMultiplier() {
        price("openrouter", "anthropic/claude-opus-5.5", "4", "20", "3");

        service.recordUsage(run("r1",
                new UsageLine("openrouter", "anthropic/claude-opus-5.5", 1, 1_000, 200, 300, 0),
                new UsageLine("anthropic", "claude-sonnet-4-6", 1, 10, 10, 0, 0)));

        assertEquals(4_500, usage.rows.get(0).poolTokens(), "(1000 + 200 + 300) x 3");
        assertEquals(20, usage.rows.get(1).poolTokens(), "an unlisted model counts once");
    }

    @Test
    void fractionalPoolTokensRoundUp() {
        assertEquals(4, ModelUsageService.poolTokens(
                new UsageLine("p", "m", 1, 3, 0, 0, 0), new BigDecimal("1.1")));
    }

    @Test
    void aModelWithoutBothPricesIsRecordedWithNoCost() {
        price("openai", "gpt-5", "1.25", null);

        service.recordUsage(run("r1",
                new UsageLine("openai", "gpt-5", 1, 10, 10, 0, 0),
                new UsageLine("anthropic", "claude-sonnet-4-6", 1, 10, 10, 0, 0)));

        assertEquals(2, usage.rows.size());
        assertNull(usage.rows.get(0).costUsd());
        assertNull(usage.rows.get(1).inputPerMtok());
    }

    @Test
    void aRepeatedReportIsNotCountedTwice() {
        UsageLine line = new UsageLine("anthropic", "claude-sonnet-4-6", 1, 10, 10, 0, 0);

        assertEquals(1, service.recordUsage(run("r1", line)));
        assertEquals(0, service.recordUsage(run("r1", line)));
        assertEquals(1, usage.rows.size());
    }

    @Test
    void incompleteOrNegativeReportsAreRefused() {
        UsageLine ok = new UsageLine("anthropic", "claude-sonnet-4-6", 1, 10, 10, 0, 0);

        RecordUsageRequest noTenant = new RecordUsageRequest("r1", "acme", " ", null, List.of(ok));
        RecordUsageRequest noModel = run("r1", new UsageLine("anthropic", "", 1, 1, 1, 0, 0));
        RecordUsageRequest negative = run("r1", new UsageLine("anthropic", "m", 1, -1, 1, 0, 0));

        assertThrows(IllegalArgumentException.class, () -> service.recordUsage(noTenant));
        assertThrows(IllegalArgumentException.class, () -> service.recordUsage(noModel));
        assertThrows(IllegalArgumentException.class, () -> service.recordUsage(negative));
        assertEquals(0, usage.rows.size());
    }

    @Test
    void totalsNeedAnOrderedPeriod() {
        OffsetDateTime now = OffsetDateTime.parse("2026-09-01T00:00:00Z");

        assertThrows(IllegalArgumentException.class, () -> service.totals(now, now, null));
        assertThrows(IllegalArgumentException.class, () -> service.totals(null, now, null));
    }
}
