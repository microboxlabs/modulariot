package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.BindingPreviewResponse;
import com.microboxlabs.miot.integrations.dto.DispatchTargetResponse;
import com.microboxlabs.miot.integrations.dto.IntegrationEventBindingResponse;
import com.microboxlabs.miot.integrations.dto.UpsertIntegrationEventBindingRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.template.PayloadRenderException;
import com.microboxlabs.miot.integrations.template.PayloadRenderer;
import com.microboxlabs.miot.integrations.template.PayloadSchema;
import com.microboxlabs.miot.integrations.template.PayloadTemplate;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Reads, validates and stores event bindings.
 *
 * <p>Two rules shape everything here:
 *
 * <ul>
 *   <li><b>Reads are parent-inclusive, writes are not.</b> An org sees its own bindings plus
 *       its parent's, so a parent configures once for the orgs beneath it — but the owning
 *       org is always stamped from the request context, so a child can never author or edit
 *       a binding on its parent's behalf.
 *   <li><b>A binding is validated before it is stored, not when it fires.</b> A mapping that
 *       cannot produce a payload is a configuration mistake the operator is standing right
 *       there to fix; discovering it hours later in a parked job helps nobody.
 * </ul>
 */
@ApplicationScoped
public class IntegrationEventBindingService {

    /** Channels whose dispatcher does not call a stored operation. */
    private static final List<ProviderType> OPERATIONLESS_PROVIDERS = List.of(ProviderType.WHATSAPP);

    private final IntegrationEventBindingRepository bindingRepository;
    private final IntegrationConnectionRepository connectionRepository;
    private final IntegrationOperationRepository operationRepository;
    private final PayloadRenderer renderer;

    @Inject
    public IntegrationEventBindingService(
            IntegrationEventBindingRepository bindingRepository,
            IntegrationConnectionRepository connectionRepository,
            IntegrationOperationRepository operationRepository,
            PayloadRenderer renderer) {
        this.bindingRepository = bindingRepository;
        this.connectionRepository = connectionRepository;
        this.operationRepository = operationRepository;
        this.renderer = renderer;
    }

    public List<IntegrationEventBindingResponse> list(String tenantClientId, String orgSlug) {
        return bindingRepository.listVisible(tenantClientId, orgSlug).stream()
                .map(binding -> IntegrationEventBindingResponse.of(binding, orgSlug))
                .toList();
    }

    /** @return the binding, or null when the id is unknown or belongs to another org tree */
    public IntegrationEventBindingResponse get(String tenantClientId, String orgSlug, String id) {
        IntegrationEventBinding binding =
                bindingRepository.findVisibleById(tenantClientId, orgSlug, id);
        return binding == null ? null : IntegrationEventBindingResponse.of(binding, orgSlug);
    }

    /**
     * @throws IllegalArgumentException naming the first structural fault, or listing every
     *         mapping fault at once
     */
    public IntegrationEventBindingResponse upsert(
            String tenantClientId,
            String orgSlug,
            UpsertIntegrationEventBindingRequest request,
            String actor) {
        require(request != null, "A request body is required");
        require(notBlank(request.eventType()), "eventType is required");
        require(notBlank(request.connectionId()), "connectionId is required");

        IntegrationConnection connection = requireUsableConnection(tenantClientId, request.connectionId());
        IntegrationOperation operation = resolveOperation(connection, request.operationId());

        List<String> problems = renderer.validate(
                request.fieldTemplates(), contractOf(operation), PayloadTemplate.DEFAULT_ROOTS);
        if (!problems.isEmpty()) {
            throw new IllegalArgumentException("The field mapping is not usable: "
                    + String.join("; ", problems));
        }

        IntegrationEventBinding binding = new IntegrationEventBinding(
                null,
                tenantClientId,
                orgSlug,                       // never from the body
                request.eventType().trim(),
                blankToNull(request.scopeKind()),
                blankToNull(request.scopeKey()),
                connection.id(),
                operation == null ? null : operation.id(),
                request.matchCondition() == null ? Map.of() : request.matchCondition(),
                request.fieldTemplates() == null ? Map.of() : request.fieldTemplates(),
                request.isEnabled(),
                null, null, actor, actor);

        return IntegrationEventBindingResponse.of(bindingRepository.upsert(binding, actor), orgSlug);
    }

    /**
     * Unbinds. A child cannot delete a binding it merely inherits — the repository's
     * visibility clause lets it *see* the parent's row, so ownership is checked here.
     *
     * @return false when the id is unknown, already gone, or owned by another org
     */
    public boolean delete(String tenantClientId, String orgSlug, String id, String actor) {
        IntegrationEventBinding binding =
                bindingRepository.findVisibleById(tenantClientId, orgSlug, id);
        if (binding == null || !binding.ownerOrgSlug().equals(orgSlug)) {
            return false;
        }
        return bindingRepository.softDelete(tenantClientId, orgSlug, id, actor);
    }

    /**
     * The channel picker's feed: every usable connection paired with each of its operations
     * and that operation's field contract.
     */
    public List<DispatchTargetResponse> dispatchTargets(String tenantClientId) {
        List<DispatchTargetResponse> targets = new ArrayList<>();
        for (IntegrationConnection connection : connectionRepository.listByTenant(tenantClientId)) {
            if (connection.status() != ConnectionStatus.ACTIVE) {
                continue;
            }
            for (IntegrationOperation operation : operationRepository.listByConnection(connection.id())) {
                PayloadSchema contract = contractOf(operation);
                targets.add(new DispatchTargetResponse(
                        connection.id(),
                        connection.name(),
                        connection.providerType().name(),
                        operation.id(),
                        operation.name(),
                        operation.method(),
                        operation.path(),
                        fieldsOf(contract),
                        templateRootsOf(contract)));
            }
        }
        return targets;
    }

    /**
     * Renders a candidate mapping against a caller-supplied context, without storing
     * anything — the server-side twin of the drawer's live preview.
     */
    public BindingPreviewResponse preview(
            String tenantClientId,
            UpsertIntegrationEventBindingRequest request,
            Map<String, Object> context) {
        require(request != null, "A request body is required");
        require(notBlank(request.connectionId()), "connectionId is required");

        IntegrationConnection connection = requireUsableConnection(tenantClientId, request.connectionId());
        IntegrationOperation operation = resolveOperation(connection, request.operationId());
        PayloadSchema contract = contractOf(operation);

        List<String> problems = renderer.validate(
                request.fieldTemplates(), contract, PayloadTemplate.DEFAULT_ROOTS);
        if (!problems.isEmpty()) {
            return BindingPreviewResponse.invalid(problems);
        }
        try {
            return BindingPreviewResponse.ok(renderer.renderBody(
                    request.fieldTemplates(), contract, context == null ? Map.of() : context));
        } catch (PayloadRenderException e) {
            return BindingPreviewResponse.invalid(e.problems());
        }
    }

    /* ---------------------------------------------------------------------- */

    private IntegrationConnection requireUsableConnection(String tenantClientId, String connectionId) {
        IntegrationConnection connection =
                connectionRepository.findByTenantAndId(tenantClientId, connectionId);
        if (connection == null) {
            throw new IllegalArgumentException("Connection " + connectionId + " does not exist");
        }
        // A DRAFT connection has never had a successful test; arming a binding on one would
        // schedule failures. The connection test is the gate, and it already exists.
        if (connection.status() != ConnectionStatus.ACTIVE) {
            throw new IllegalArgumentException("Connection '" + connection.name()
                    + "' is " + connection.status() + "; test it before binding an event to it");
        }
        return connection;
    }

    /**
     * Operation-based channels must name one that belongs to the connection; the others must
     * not name one at all, so a stale id cannot imply a call that will never be made.
     */
    private IntegrationOperation resolveOperation(IntegrationConnection connection, String operationId) {
        boolean operationless = OPERATIONLESS_PROVIDERS.contains(connection.providerType());
        if (operationless) {
            return null;
        }
        if (!notBlank(operationId)) {
            throw new IllegalArgumentException("operationId is required for "
                    + connection.providerType() + " connections");
        }
        IntegrationOperation operation =
                operationRepository.findByConnectionAndId(connection.id(), operationId);
        if (operation == null) {
            throw new IllegalArgumentException(
                    "Operation " + operationId + " does not belong to connection '" + connection.name() + "'");
        }
        return operation;
    }

    /** A channel with no operation declares no contract, so everything maps as text. */
    private static PayloadSchema contractOf(IntegrationOperation operation) {
        return operation == null ? PayloadSchema.empty() : PayloadSchema.of(operation.requestSchema());
    }

    private static List<DispatchTargetResponse.Field> fieldsOf(PayloadSchema schema) {
        // Dotted paths, in contract order: a collection row for each array naming where its
        // elements come from, then the value rows it scopes. The array row is what used to be
        // answered by itemsFrom inside the schema — mapping knowledge that belongs to the binding.
        return schema.mappingRows().stream()
                .map(row -> new DispatchTargetResponse.Field(
                        row.id(),
                        row.type().name().toLowerCase(),
                        row.required(),
                        row.contextRoot(),
                        row.collection()
                                ? DispatchTargetResponse.Field.COLLECTION
                                : DispatchTargetResponse.Field.VALUE))
                .toList();
    }

    /**
     * Every root a template for this contract may read — the always-present ones plus the bind
     * names its arrays introduce. The same set {@link PayloadRenderer#validate} accepts, so the
     * drawer cannot call a mapping invalid that the server would store.
     */
    private static List<String> templateRootsOf(PayloadSchema schema) {
        List<String> roots = new ArrayList<>(PayloadTemplate.DEFAULT_ROOTS);
        for (String bindName : schema.arrayBindNames()) {
            if (!roots.contains(bindName)) {
                roots.add(bindName);
            }
        }
        return List.copyOf(roots);
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String blankToNull(String value) {
        return notBlank(value) ? value.trim() : null;
    }
}
