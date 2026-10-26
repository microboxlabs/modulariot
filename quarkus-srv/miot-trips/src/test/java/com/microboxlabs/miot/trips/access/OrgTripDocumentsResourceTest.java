package com.microboxlabs.miot.trips.access;

import com.microboxlabs.miot.trips.api.OrgTripDocumentsResource;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import io.smallrye.mutiny.Uni;
import java.time.Duration;
import java.util.Set;
import org.junit.jupiter.api.Test;

class OrgTripDocumentsResourceTest {
    private static final String ID = "11111111-1111-1111-1111-111111111111";

    private static OrgTripDocumentsResource resource(Set<String> permissions) {
        return new OrgTripDocumentsResource(null, null, null, null, null) {
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
