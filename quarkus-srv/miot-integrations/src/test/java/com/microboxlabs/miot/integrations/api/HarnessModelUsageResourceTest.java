package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.integrations.dto.ModelUsageDtos.RecordUsageRequest;
import com.microboxlabs.miot.integrations.service.ModelUsageService;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class HarnessModelUsageResourceTest {

    static final class FakeService extends ModelUsageService {
        int calls;

        FakeService() {
            super(null, null);
        }

        @Override
        public int record(RecordUsageRequest req) {
            calls++;
            if (req.runId() == null) {
                throw new IllegalArgumentException("runId and tenantId are required");
            }
            return 1;
        }
    }

    private final FakeService service = new FakeService();

    private Response call(Optional<String> configured, String presented, RecordUsageRequest body) {
        return new HarnessModelUsageResource(service, configured)
                .record(presented, body)
                .await()
                .indefinitely();
    }

    private static final RecordUsageRequest BODY =
            new RecordUsageRequest("r1", "acme", "tenant-1", null, List.of());

    @Test
    void nothingIsRecordedWithoutTheRightKey() {
        assertEquals(503, call(Optional.empty(), "anything", BODY).getStatus());
        assertEquals(401, call(Optional.of("the-key"), "wrong", BODY).getStatus());
        assertEquals(0, service.calls);
    }

    @Test
    void theRightKeyRecordsAndABadBodyIs400() {
        assertEquals(200, call(Optional.of("the-key"), "the-key", BODY).getStatus());
        assertEquals(400, call(Optional.of("the-key"), "the-key",
                new RecordUsageRequest(null, null, null, null, null)).getStatus());
    }
}
