package com.microboxlabs.miot.fleet.access;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.ModuleDef;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/** The fleet module: assets reported by GPS and the organizations that share them. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetAccessCatalog implements AccessCatalog {

    public static final String MODULE = "fleet";

    public static final String NETWORK_VIEW = "fleet:network.view";

    public static final String VIEWER = "FLEET_VIEWER";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(PermissionDef.of(NETWORK_VIEW, "Ver los assets y las organizaciones relacionadas",
                "View assets and related organizations"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(RoleDef.of(VIEWER, MODULE, "Lector", "Viewer", Set.of(NETWORK_VIEW))
                .describedAs("Ve los assets de la organización y con quién los comparte.",
                        "Sees the organization's assets and who it shares them with."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(ModuleDef.of(MODULE, "Flota", "Fleet",
                "Los assets que reportan los GPS y las organizaciones que los comparten.",
                "Assets reported by GPS and the organizations that share them."));
    }
}
