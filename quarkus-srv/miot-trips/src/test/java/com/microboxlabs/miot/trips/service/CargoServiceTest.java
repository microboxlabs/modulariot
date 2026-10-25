package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.dto.CargoRequest;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.ReceiveRequest;
import com.microboxlabs.miot.trips.store.InMemoryFleet;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CargoServiceTest {

    private static final String TENANT = "tenant-b";
    private static final String ACTOR = "feed:b";

    private final InMemoryTripsWorld world = new InMemoryTripsWorld();
    private final AuditService audit = new AuditService(world.auditStore);
    private final Transactions tx = Transactions.none();
    private final MandateService mandates = new MandateService(world.mandateStore, audit, tx);
    private final CargoService service = new CargoService(world.cargoStore, mandates,
            world.projector(new InMemoryFleet()), audit, tx);

    private UUID mandateId;

    @BeforeEach
    void mandate() {
        mandateId = UUID.fromString(mandates.createOrGet(TENANT, ACTOR,
                new MandateRequest("OC-5001", "oc", null, null, null, null)).mandate().id());
    }

    @Test
    void partialsNumberThemselvesAgainstTheLine() {
        CargoRequest empty = CargoRequest.empty();
        assertThrows(IllegalArgumentException.class,
                () -> service.announce(TENANT, ACTOR, mandateId, empty));

        CargoUnit first = service.announce(TENANT, ACTOR, mandateId,
                new CargoRequest("Camarón 20 pallets", new BigDecimal("20"), "pallet", null, null, null));
        CargoUnit second = service.announce(TENANT, ACTOR, mandateId,
                new CargoRequest("Camarón saldo", new BigDecimal("8"), "pallet", null, null, "ready"));

        assertEquals(1, first.partialNo());
        assertEquals(2, second.partialNo());
        assertEquals(CargoUnit.ANNOUNCED, first.status());
        assertEquals(CargoUnit.READY, second.status());
        assertEquals(2, service.listByMandate(TENANT, mandateId).size());
    }

    @Test
    void theApiOnlyMovesStatusForwardWithinTheAnnounceSet() {
        CargoUnit unit = service.announce(TENANT, ACTOR, mandateId,
                new CargoRequest("Carga", null, null, null, null, null));
        UUID id = UUID.fromString(unit.id());

        assertEquals(CargoUnit.READY,
                service.update(TENANT, ACTOR, id, new CargoRequest(null, null, null, null, null, "ready"))
                        .status());
        CargoRequest backwards = new CargoRequest(null, null, null, null, null, "announced");
        assertThrows(IllegalStateException.class, () -> service.update(TENANT, ACTOR, id, backwards));
        CargoRequest picked = new CargoRequest(null, null, null, null, null, "picked_up");
        IllegalArgumentException refused = assertThrows(IllegalArgumentException.class,
                () -> service.update(TENANT, ACTOR, id, picked));
        assertTrue(refused.getMessage().contains("execution"));
    }

    @Test
    void receptionNeedsADeliveredCargoAndADetailOnDiferencia() {
        CargoUnit unit = service.announce(TENANT, ACTOR, mandateId,
                new CargoRequest("Carga", null, null, null, null, null));
        UUID id = UUID.fromString(unit.id());

        ReceiveRequest conforme = new ReceiveRequest("conforming", null);
        assertThrows(IllegalStateException.class, () -> service.receive(TENANT, ACTOR, id, conforme));

        // the execution delivers it
        world.cargoStore.update(new CargoUnit(unit.id(), TENANT, unit.lineId(), unit.partialNo(), unit.description(),
                unit.qty(), unit.qtyUnit(), unit.weightKg(), unit.volumeM3(), CargoUnit.DELIVERED,
                null, null, null, unit.createdAt(), unit.createdBy(), null, ACTOR));

        ReceiveRequest noDetail = new ReceiveRequest("discrepancy", " ");
        assertThrows(IllegalArgumentException.class, () -> service.receive(TENANT, ACTOR, id, noDetail));
        CargoUnit received = service.receive(TENANT, ACTOR, id, new ReceiveRequest("discrepancy", "faltó 1 pallet"));
        assertEquals(CargoUnit.RECEIVED, received.status());
        assertEquals("discrepancy", received.receiptResult());
        assertNotNull(received.receivedAt());
    }
}
