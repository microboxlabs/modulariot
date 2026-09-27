package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.HarnessModelProvider;
import com.microboxlabs.miot.integrations.service.ModelProviderService;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class HarnessModelProvidersResourceTest {

    static final class FakeService extends ModelProviderService {
        FakeService() {
            super(null, null);
        }

        @Override
        public List<HarnessModelProvider> forHarness() {
            return List.of(new HarnessModelProvider("deepseek", null, "sk-ds", List.of()));
        }
    }

    private static Response call(Optional<String> configured, String presented) {
        return new HarnessModelProvidersResource(new FakeService(), configured)
                .list(presented)
                .await()
                .indefinitely();
    }

    @Test
    void withoutAConfiguredKeyNothingIsServed() {
        assertEquals(503, call(Optional.empty(), "anything").getStatus());
    }

    @Test
    void aWrongOrMissingKeyIsRefused() {
        assertEquals(401, call(Optional.of("the-key"), "not-the-key").getStatus());
        assertEquals(401, call(Optional.of("the-key"), null).getStatus());
    }

    @Test
    void theRightKeyGetsTheProvidersUncached() {
        Response response = call(Optional.of("the-key"), "the-key");

        assertEquals(200, response.getStatus());
        assertEquals("no-store", response.getHeaderString("Cache-Control"));
        @SuppressWarnings("unchecked")
        List<HarnessModelProvider> providers =
                (List<HarnessModelProvider>) ((Map<String, Object>) response.getEntity()).get("providers");
        assertEquals("sk-ds", providers.get(0).apiKey());
    }
}
