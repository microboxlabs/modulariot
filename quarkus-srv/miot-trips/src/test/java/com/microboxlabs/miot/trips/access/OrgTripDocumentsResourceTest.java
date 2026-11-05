package com.microboxlabs.miot.trips.access;

import com.microboxlabs.miot.trips.api.OrgTripDocumentsResource;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.trips.domain.TripDocument;
import com.microboxlabs.miot.trips.service.TripDocumentService;
import java.util.UUID;
import io.smallrye.mutiny.Uni;
import java.time.Duration;
import java.util.Set;
import org.junit.jupiter.api.Test;

class OrgTripDocumentsResourceTest {
    private static final String ID = "11111111-1111-1111-1111-111111111111";

    private static OrgTripDocumentsResource resource(Set<String> permissions) {
        return resource(permissions, false);
    }

    private static OrgTripDocumentsResource resource(Set<String> permissions, boolean linked) {
        TripDocument document = new TripDocument(ID, "test", ID, ID, "proof.pdf", "PROOF_OF_DELIVERY", 1, true,
                "pending", null, null, linked ? ID : null, "application/pdf", 1L, null, "ops@example.com",
                null, "ops@example.com");
        TripDocumentService documents = new TripDocumentService(null, null, null, null, null, null, null) {
            @Override
            public TripDocument document(String tenant, UUID trip, UUID id) {
                return document;
            }

            @Override
            public TripDocument change(String tenant, String actor, UUID trip, UUID id, String type, String name) {
                return document;
            }
        };
        return new OrgTripDocumentsResource(null, null, null, null, documents) {
            @Override
            protected String tenantCode(String org) {
                return "test";
            }

            @Override
            protected String actor() {
                return "ops@example.com";
            }

            @Override
            protected Uni<Access> access(String org) {
                return Uni.createFrom().item(new Access(1L, org, null, Set.of(), permissions));
            }
        };
    }

    @Test
    void linkedReplaceRequiresDeliveryPermissionBeforeOpeningTheFile() {
        var response = resource(Set.of(TripsAccessCatalog.DOCUMENT_MANAGE), true)
                .replace("test", ID, ID, null).await().atMost(Duration.ofSeconds(5));
        assertEquals(403, response.getStatus());
    }

    @Test
    void linkedChangeRequiresDeliveryPermission() {
        var response = resource(Set.of(TripsAccessCatalog.DOCUMENT_MANAGE), true)
                .change("test", ID, ID, null).await().atMost(Duration.ofSeconds(5));
        assertEquals(403, response.getStatus());
    }

    @Test
    void linkedChangeSucceedsWithBothPermissions() {
        var response = resource(Set.of(TripsAccessCatalog.DOCUMENT_MANAGE, TripsAccessCatalog.DELIVERY_OPERATE), true)
                .change("test", ID, ID, null).await().atMost(Duration.ofSeconds(5));
        assertEquals(200, response.getStatus());
    }

    @Test
    void unlinkedChangeNeedsOnlyDocumentPermission() {
        var response = resource(Set.of(TripsAccessCatalog.DOCUMENT_MANAGE))
                .change("test", ID, ID, null).await().atMost(Duration.ofSeconds(5));
        assertEquals(200, response.getStatus());
    }

    @Test
    void linkedUploadRequiresDeliveryPermissionBeforeOpeningTheFile() {
        var response = resource(Set.of(TripsAccessCatalog.DOCUMENT_MANAGE))
                .upload("test", ID, null, "PROOF_OF_DELIVERY", ID).await().atMost(Duration.ofSeconds(5));
        assertEquals(403, response.getStatus());
    }

    @Test
    void unlinkedUploadNeedsOnlyDocumentPermission() {
        var response = resource(Set.of(TripsAccessCatalog.DOCUMENT_MANAGE))
                .upload("test", ID, null, "OTHER", null).await().atMost(Duration.ofSeconds(5));
        assertEquals(400, response.getStatus(), "normal file validation should be reached");
    }

    @Test
    void deliveryOperatorReachesFileValidationForLinkedUpload() {
        var response = resource(Set.of(TripsAccessCatalog.DOCUMENT_MANAGE, TripsAccessCatalog.DELIVERY_OPERATE))
                .upload("test", ID, null, "PROOF_OF_DELIVERY", ID).await().atMost(Duration.ofSeconds(5));
        assertEquals(400, response.getStatus());
    }
}
