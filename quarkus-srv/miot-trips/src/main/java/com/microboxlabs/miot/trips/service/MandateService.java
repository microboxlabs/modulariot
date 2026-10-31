package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MandateLine;
import com.microboxlabs.miot.trips.domain.TripRef;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.store.MandateStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Mandates: the order header a mandante places. Creation is create-or-return by
 * (tenant, externalCode), so the feeds stay idempotent and codes never collide
 * across mandantes.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class MandateService {

    static final String ENTITY = "mandate";
    private static final String ORDER_TYPE = "orderType";
    private static final String MANDATE_NOT_FOUND = "mandate not found";

    public static final int MAX_PAGE_SIZE = 200;

    private final MandateStore store;
    private final AuditService audit;
    private final Transactions tx;

    @Inject
    public MandateService(MandateStore store, AuditService audit, Transactions tx) {
        this.store = store;
        this.audit = audit;
        this.tx = tx;
    }

    /** Creates, or returns the existing mandate with the same code; {@code created} says which. */
    public CreateOrGet createOrGet(String tenantCode, String actor, MandateRequest body) {
        return tx.inTransaction(() -> {
            MandateRequest req = body == null ? MandateRequest.empty() : body;
            String code = required(req.externalCode(), "externalCode", 128);
            String orderType = req.orderType() == null || req.orderType().isBlank() ? "service"
                    : limited(req.orderType(), ORDER_TYPE, 32);
            MandateStore.CreateOrGet result = store.insertOrGet(new Mandate(
                    null, tenantCode, code, orderType, limitedOrNull(req.orderRef(), "orderRef", 255),
                    Mandate.ACTIVE, Check.uuidOrNull(req.originId(), "originId"),
                    Check.uuidOrNull(req.destinationId(), "destinationId"), req.slaMinutes(),
                    null, null, null, actor, null, actor));
            if (result.created()) {
                audit.log(tenantCode, actor, "mandate.created", ENTITY, result.mandate().id(), null,
                        Map.of("externalCode", code, ORDER_TYPE, orderType));
            }
            return new CreateOrGet(result.mandate(), result.created());
        });
    }

    public Mandate get(String tenantCode, UUID id) {
        return store.find(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException(MANDATE_NOT_FOUND));
    }

    public MandateLine lineOf(String tenantCode, UUID mandateId) {
        return store.lineOf(tenantCode, mandateId)
                .orElseThrow(() -> new NoSuchElementException(MANDATE_NOT_FOUND));
    }

    public List<TripRef> tripsOf(String tenantCode, UUID mandateId) {
        return store.tripsOf(tenantCode, mandateId);
    }

    public List<Mandate> list(String tenantCode, String status, String externalCode, Integer page, Integer size) {
        int p = page == null ? 0 : Math.max(page, 0);
        int s = size == null ? 50 : size;
        if (s < 1 || s > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return store.list(tenantCode, blankToNull(status), blankToNull(externalCode), p, s);
    }

    /** Patches header data; null keeps, empty clears. The status moves through close/cancel only. */
    public Mandate update(String tenantCode, String actor, UUID id, MandateRequest body) {
        return tx.inTransaction(() -> {
            MandateRequest req = body == null ? MandateRequest.empty() : body;
            Mandate current = get(tenantCode, id);
            Mandate updated = store.update(new Mandate(
                    current.id(), tenantCode, current.externalCode(),
                    orKeep(req.orderType(), current.orderType(), ORDER_TYPE, 32),
                    orKeep(req.orderRef(), current.orderRef(), "orderRef", 255),
                    current.status(),
                    req.originId() == null ? current.originId() : Check.uuidOrNull(req.originId(), "originId"),
                    req.destinationId() == null ? current.destinationId() : Check.uuidOrNull(req.destinationId(), "destinationId"),
                    req.slaMinutes() == null ? current.slaMinutes() : req.slaMinutes(),
                    current.closedAt(), current.cancelReason(),
                    current.createdAt(), current.createdBy(), null, actor))
                    .orElseThrow(() -> new NoSuchElementException(MANDATE_NOT_FOUND));
            audit.log(tenantCode, actor, "mandate.updated", ENTITY, updated.id(), null, Map.of());
            return updated;
        });
    }

    /** A closed or cancelled mandate takes no new trip, directly or through mounted cargo. */
    void requireOpen(String tenantCode, UUID mandateId) {
        String status = store.statusForLink(tenantCode, mandateId)
                .orElseThrow(() -> new IllegalArgumentException("mandate " + mandateId + " does not exist"));
        if (Mandate.CLOSED.equals(status) || Mandate.CANCELLED.equals(status)) {
            throw new IllegalStateException("mandate " + mandateId + " is " + status);
        }
    }

    /** Closes; every linked trip must be completed or cancelled. */
    public Mandate close(String tenantCode, String actor, UUID id) {
        return tx.inTransaction(() -> {
            Mandate current = get(tenantCode, id);
            if (Mandate.CLOSED.equals(current.status())) {
                throw new IllegalStateException("mandate already closed");
            }
            if (Mandate.CANCELLED.equals(current.status())) {
                throw new IllegalStateException("mandate is cancelled");
            }
            int open = store.openTrips(tenantCode, id);
            if (open > 0) {
                throw new IllegalStateException("mandate has " + open + " trip(s) not yet realized");
            }
            Mandate closed = store.update(withStatus(current, Mandate.CLOSED,
                    OffsetDateTime.now(ZoneOffset.UTC), current.cancelReason(), actor))
                    .orElseThrow(() -> new NoSuchElementException(MANDATE_NOT_FOUND));
            audit.log(tenantCode, actor, "mandate.closed", ENTITY, closed.id(), null, Map.of());
            return closed;
        });
    }

    public Mandate cancel(String tenantCode, String actor, UUID id, String reason) {
        return tx.inTransaction(() -> {
            Mandate current = get(tenantCode, id);
            if (Mandate.CLOSED.equals(current.status()) || Mandate.CANCELLED.equals(current.status())) {
                throw new IllegalStateException("mandate already " + current.status());
            }
            String why = required(reason, "reason", 500);
            Mandate cancelled = store.update(withStatus(current, Mandate.CANCELLED,
                    OffsetDateTime.now(ZoneOffset.UTC), why, actor))
                    .orElseThrow(() -> new NoSuchElementException(MANDATE_NOT_FOUND));
            audit.log(tenantCode, actor, "mandate.cancelled", ENTITY, cancelled.id(), null, Map.of("reason", why));
            return cancelled;
        });
    }

    /** Marks the mandate running when its first trip starts; a no-op on any other status. */
    public void markRunning(String tenantCode, String actor, UUID id) {
        tx.inTransaction(() -> {
            store.find(tenantCode, id)
                    .filter(m -> Mandate.ACTIVE.equals(m.status()))
                    .ifPresent(m -> store.update(withStatus(m, Mandate.RUNNING, m.closedAt(), m.cancelReason(), actor)));
        });
    }

    private static Mandate withStatus(Mandate m, String status, OffsetDateTime closedAt, String reason,
            String actor) {
        return new Mandate(m.id(), m.tenantCode(), m.externalCode(), m.orderType(), m.orderRef(), status,
                m.originId(), m.destinationId(), m.slaMinutes(), closedAt, reason,
                m.createdAt(), m.createdBy(), null, actor);
    }

    private static String required(String value, String field, int max) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return limited(value.trim(), field, max);
    }

    private static String limited(String value, String field, int max) {
        if (value.length() > max) {
            throw new IllegalArgumentException(field + " must be at most " + max + " characters");
        }
        return value;
    }

    private static String limitedOrNull(String value, String field, int max) {
        return value == null || value.isBlank() ? null : limited(value.trim(), field, max);
    }

    private static String orKeep(String incoming, String current, String field, int max) {
        if (incoming == null) {
            return current;
        }
        return incoming.isBlank() ? null : limited(incoming.trim(), field, max);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    public record CreateOrGet(Mandate mandate, boolean created) {
    }
}
