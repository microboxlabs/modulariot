package com.microboxlabs.miot.fleet.network;

import java.util.Set;

/** Another organization, as the API shows it. */
public record OrgRef(String id, String name, Set<OrgRole> roles) {

    static OrgRef of(NetworkOrganization organization) {
        return new OrgRef(organization.id(), organization.name(), organization.roles());
    }
}
