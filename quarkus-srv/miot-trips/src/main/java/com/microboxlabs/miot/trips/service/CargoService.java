package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.MandateLine;
import com.microboxlabs.miot.trips.dto.CargoRequest;
import com.microboxlabs.miot.trips.dto.ReceiveRequest;
import com.microboxlabs.miot.trips.store.CargoStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

/**
 * Cargo units: the partials a shipper announces against a mandate line, the
 * indivisible units of delivery. The execution (stages) moves their status
 * forward; reception closes them as conforme or diferencia.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class CargoService {

    static final String ENTITY = "cargo";
    private static final String DESCRIPTION = "description";
    private static final String QTY_UNIT = "qtyUnit";
    private static final String CARGO_NOT_FOUND = "cargo not found";

    /** The statuses the API may set directly; retirada/entregada come from the execution. */
    private static final Set<String> ANNOUNCE_STATUSES = Set.of(CargoUnit.ANNOUNCED, CargoUnit.READY);
    private static final List<String> ORDER = List.of(CargoUnit.ANNOUNCED, CargoUnit.READY, CargoUnit.PICKED,
            CargoUnit.DELIVERED, CargoUnit.RECEIVED, CargoUnit.REJECTED);

    private final CargoStore store;
    private final MandateService mandates;
    private final AuditService audit;

    @Inject
    public CargoService(CargoStore store, MandateService mandates, AuditService audit) {
        this.store = store;
        this.mandates = mandates;
        this.audit = audit;
    }

    public CargoUnit announce(String tenantCode, String actor, UUID mandateId, CargoRequest body) {
        CargoRequest req = body == null ? CargoRequest.empty() : body;
        String description = Check.required(req.description(), DESCRIPTION, 500);
        String status = req.status() == null || req.status().isBlank() ? CargoUnit.ANNOUNCED : req.status();
        if (!ANNOUNCE_STATUSES.contains(status)) {
            throw new IllegalArgumentException("status must be one of " + ANNOUNCE_STATUSES);
        }
        MandateLine line = mandates.lineOf(tenantCode, mandateId);
        CargoUnit created = store.insert(new CargoUnit(
                null, tenantCode, line.id(), 0, description,
                req.qty(), Check.limitedOrNull(req.qtyUnit(), QTY_UNIT, 32), req.weightKg(), req.volumeM3(),
                status, null, null, null, null, actor, null, actor));
        audit.log(tenantCode, actor, "cargo.announced", ENTITY, created.id(), null,
                Map.of("mandateId", mandateId.toString(), "partial", created.partialNo()));
        return created;
    }

    public List<CargoUnit> listByMandate(String tenantCode, UUID mandateId) {
        mandates.get(tenantCode, mandateId);
        return store.listByMandate(tenantCode, mandateId);
    }

    public CargoUnit get(String tenantCode, UUID id) {
        return store.find(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException(CARGO_NOT_FOUND));
    }

    /** Patches quantities/cubication, and status only forward within anunciada→lista. */
    public CargoUnit update(String tenantCode, String actor, UUID id, CargoRequest body) {
        CargoRequest req = body == null ? CargoRequest.empty() : body;
        CargoUnit current = get(tenantCode, id);
        String status = current.status();
        if (req.status() != null && !req.status().isBlank() && !req.status().equals(status)) {
            if (!ANNOUNCE_STATUSES.contains(req.status())) {
                throw new IllegalArgumentException("the API only sets " + ANNOUNCE_STATUSES
                        + "; the execution moves the rest");
            }
            if (ORDER.indexOf(req.status()) < ORDER.indexOf(status)) {
                throw new IllegalStateException("status cannot move backwards");
            }
            status = req.status();
        }
        CargoUnit updated = store.update(new CargoUnit(
                current.id(), tenantCode, current.lineId(), current.partialNo(),
                req.description() == null || req.description().isBlank() ? current.description()
                        : Check.required(req.description(), DESCRIPTION, 500),
                req.qty() == null ? current.qty() : req.qty(),
                Check.orKeep(req.qtyUnit(), current.qtyUnit(), QTY_UNIT, 32),
                req.weightKg() == null ? current.weightKg() : req.weightKg(),
                req.volumeM3() == null ? current.volumeM3() : req.volumeM3(),
                status, current.receiptResult(), current.receiptNotes(), current.receivedAt(),
                current.createdAt(), current.createdBy(), null, actor))
                .orElseThrow(() -> new NoSuchElementException(CARGO_NOT_FOUND));
        audit.log(tenantCode, actor, "cargo.updated", ENTITY, updated.id(), null, Map.of());
        return updated;
    }

    /** Receives a delivered cargo as conforme or diferencia. */
    public CargoUnit receive(String tenantCode, String actor, UUID id, ReceiveRequest body) {
        ReceiveRequest req = body == null ? new ReceiveRequest(null, null) : body;
        if (req.result() == null || !Set.of("conforme", "diferencia").contains(req.result())) {
            throw new IllegalArgumentException("result must be conforme or diferencia");
        }
        if ("diferencia".equals(req.result()) && (req.notes() == null || req.notes().isBlank())) {
            throw new IllegalArgumentException("notes: a diferencia needs the detail");
        }
        CargoUnit current = get(tenantCode, id);
        if (!CargoUnit.DELIVERED.equals(current.status())) {
            throw new IllegalStateException("cargo must be entregada to receive it (is " + current.status() + ")");
        }
        CargoUnit received = store.update(new CargoUnit(
                current.id(), tenantCode, current.lineId(), current.partialNo(), current.description(),
                current.qty(), current.qtyUnit(), current.weightKg(), current.volumeM3(),
                CargoUnit.RECEIVED, req.result(), blankToNull(req.notes()),
                OffsetDateTime.now(ZoneOffset.UTC),
                current.createdAt(), current.createdBy(), null, actor))
                .orElseThrow(() -> new NoSuchElementException(CARGO_NOT_FOUND));
        audit.log(tenantCode, actor, "cargo.received", ENTITY, received.id(), null,
                Map.of("result", req.result()));
        return received;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
