package com.microboxlabs.miot.fleet.access;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.ModuleDef;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/** The fleet module: the organization's assets, filled from GPS signals and trips, and editable. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetAccessCatalog implements AccessCatalog {

    public static final String MODULE = "fleet";

    public static final String ASSETS_VIEW = "fleet:assets.view";
    public static final String ASSETS_EDIT = "fleet:assets.edit";

    public static final String VIEWER = "FLEET_VIEWER";
    public static final String MANAGER = "FLEET_MANAGER";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(ASSETS_VIEW, "Ver la flota", "View the fleet"),
                PermissionDef.of(ASSETS_EDIT, "Editar los datos de la flota", "Edit fleet data"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(VIEWER, MODULE, "Lector", "Viewer", Set.of(ASSETS_VIEW))
                        .describedAs("Ve los assets, sus viajes e indicadores.",
                                "Sees the assets, their trips and indicators."),
                RoleDef.of(MANAGER, MODULE, "Administrador de flota", "Fleet manager", Set.of(ASSETS_VIEW, ASSETS_EDIT))
                        .describedAs("Además edita los datos, documentos y sugerencias de cada asset.",
                                "Also edits each asset's data, documents and suggestions."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(ModuleDef.of(MODULE, "Flota", "Fleet",
                "Los assets de la organización con sus viajes, documentos e indicadores.",
                "The organization's assets with their trips, documents and indicators."));
    }
}
