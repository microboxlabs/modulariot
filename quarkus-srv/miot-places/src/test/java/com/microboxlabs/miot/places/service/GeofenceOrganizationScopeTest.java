package com.microboxlabs.miot.places.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.model.Organization;
import org.junit.jupiter.api.Test;

class GeofenceOrganizationScopeTest {

    private static Organization organization(String clientId, Organization parent) {
        Organization org = new Organization();
        org.tenantClientId = clientId;
        org.parent = parent;
        return org;
    }

    @Test
    void theParentKeepsItsOwnCatalog() {
        assertTrue(GeofenceOrganizationScope.hasOwnSource(organization("parent-client", null), null));
    }

    @Test
    void aChildCannotReadItsParentsSharedClient() {
        Organization parent = organization("parent-client", null);
        assertFalse(GeofenceOrganizationScope.hasOwnSource(organization("parent-client", parent), parent));
    }

    @Test
    void aChildWithItsOwnClientCanReadItsOwnCatalog() {
        Organization parent = organization("parent-client", null);
        assertTrue(GeofenceOrganizationScope.hasOwnSource(organization("child-client", parent), parent));
    }

    @Test
    void missingOrganizationOrParentIsDenied() {
        Organization child = organization("child-client", organization("parent-client", null));
        assertFalse(GeofenceOrganizationScope.hasOwnSource(null, null));
        assertFalse(GeofenceOrganizationScope.hasOwnSource(child, null));
    }
}
