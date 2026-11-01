package com.microboxlabs.miot.places.service;

import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Objects;

/** Shared-client sub-accounts need an ownership mapping before reading the parent's geofences. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class GeofenceOrganizationScope {

    public Uni<Boolean> allows(String organizationId) {
        return Panache.withSession(() -> Organization.findBySlug(organizationId).flatMap(org -> {
            if (org == null || org.parent == null) return Uni.createFrom().item(hasOwnSource(org, null));
            return Organization.byId(org.parent.id).map(parent -> hasOwnSource(org, parent));
        }));
    }

    static boolean hasOwnSource(Organization org, Organization parent) {
        if (org == null) return false;
        return org.parent == null || parent != null && !Objects.equals(org.tenantClientId, parent.tenantClientId);
    }
}
