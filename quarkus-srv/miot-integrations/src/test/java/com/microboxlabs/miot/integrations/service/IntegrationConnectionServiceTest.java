package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertNull;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntegrationConnectionServiceTest {

    @Test
    @SuppressWarnings("unchecked")
    void safeMapPreservesNullValues() throws Exception {
        Method safeMap = IntegrationConnectionService.class.getDeclaredMethod("safeMap", Map.class);
        safeMap.setAccessible(true);

        Map<String, Object> source = new LinkedHashMap<>();
        source.put("nullable", null);

        Map<String, Object> result = (Map<String, Object>) safeMap.invoke(serviceWithoutDependencies(), source);

        assertNull(result.get("nullable"));
    }

    private IntegrationConnectionService serviceWithoutDependencies() {
        return new IntegrationConnectionService(null, null, null, null, null);
    }
}
