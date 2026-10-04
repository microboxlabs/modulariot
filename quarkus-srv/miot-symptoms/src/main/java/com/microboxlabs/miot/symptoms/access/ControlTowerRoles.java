package com.microboxlabs.miot.symptoms.access;

import com.microboxlabs.miot.core.permission.OrganizationRoleCatalog;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Set;

/** The control tower's organization roles. {@link ControlTowerPermission} says what each allows. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class ControlTowerRoles implements OrganizationRoleCatalog {

    public static final String VIEWER = "CONTROL_TOWER_VIEWER";
    public static final String OPERATOR = "CONTROL_TOWER_OPERATOR";
    public static final String MAINTAINER = "CONTROL_TOWER_MAINTAINER";

    @Override
    public Set<String> roleCodes() {
        return Set.of(VIEWER, OPERATOR, MAINTAINER);
    }
}
