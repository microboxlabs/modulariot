package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationTemplateRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * CRUD for integration templates — the operator-defined types instances are created from.
 * A template owns the payload contract; {@link IntegrationConnectionService} copies it onto
 * each instance's operation at creation time.
 */
@ApplicationScoped
public class IntegrationTemplateService {

    private final IntegrationTemplateRepository templateRepository;
    private final IntegrationConnectionRepository connectionRepository;

    @Inject
    public IntegrationTemplateService(
            IntegrationTemplateRepository templateRepository,
            IntegrationConnectionRepository connectionRepository) {
        this.templateRepository = templateRepository;
        this.connectionRepository = connectionRepository;
    }

    public List<IntegrationTemplate> listTemplates(String tenantCode) {
        return templateRepository.listByTenant(tenantCode);
    }

    public IntegrationTemplate getTemplate(String tenantCode, String templateId) {
        return templateRepository.findByTenantAndId(tenantCode, templateId);
    }

    public IntegrationTemplate createTemplate(String tenantCode, CreateIntegrationTemplateRequest req) {
        // The operation name shown against every instance defaults to the template's name.
        String operationName = blankToNull(req.operationName()) == null ? req.name() : req.operationName();
        IntegrationTemplate template = new IntegrationTemplate(
                UUID.randomUUID().toString(),
                tenantCode,
                req.name(),
                req.providerType(),
                operationName,
                normalizeMethod(req.method()),
                req.path(),
                safeMap(req.requestSchema()),
                safeMap(req.responseSchema()));
        return templateRepository.create(template);
    }

    /** @return the updated template, or {@code null} when it does not exist. */
    public IntegrationTemplate updateTemplate(
            String tenantCode, String templateId, UpdateIntegrationTemplateRequest req) {
        return templateRepository.update(
                tenantCode,
                templateId,
                blankToNull(req.name()),
                blankToNull(req.operationName()),
                normalizeMethodOrNull(req.method()),
                blankToNull(req.path()),
                req.requestSchema(),
                req.responseSchema());
    }

    /**
     * Soft-deletes a template. Refuses (throws {@link IllegalStateException}) while any
     * connection is still an instance of it, so a type is never pulled out from under its
     * instances.
     *
     * @return {@code false} when the template did not exist
     */
    public boolean deleteTemplate(String tenantCode, String templateId) {
        int instances = connectionRepository.listByTemplate(tenantCode, templateId).size();
        if (instances > 0) {
            throw new IllegalStateException(
                    "Cannot delete a template with " + instances + " connection(s) still using it");
        }
        return templateRepository.softDelete(tenantCode, templateId);
    }

    private static String normalizeMethod(String method) {
        return method == null ? null : method.trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizeMethodOrNull(String method) {
        return blankToNull(method) == null ? null : normalizeMethod(method);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private Map<String, Object> safeMap(Map<String, Object> map) {
        return map == null ? Map.of() : new LinkedHashMap<>(map);
    }
}
