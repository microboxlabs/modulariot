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

    public static final String RESOURCES_VIEW = "fleet:resources.view";
    public static final String RESOURCES_WRITE = "fleet:resources.write";
    public static final String ACCREDITATION_WRITE = "fleet:accreditation.write";

    public static final String VIEWER = "FLEET_VIEWER";
    public static final String MANAGER = "FLEET_MANAGER";

    /** Only the fleet roles grant these: owners and admins see the fleet once someone assigns them a role. */
    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(ASSETS_VIEW, "Ver la flota", "View the fleet").explicit(),
                PermissionDef.of(ASSETS_EDIT, "Editar los datos de la flota", "Edit fleet data").explicit(),
                PermissionDef.of(RESOURCES_VIEW, "Ver el directorio de recursos", "View the resource directory").explicit(),
                PermissionDef.of(RESOURCES_WRITE, "Mantener el directorio de recursos", "Maintain the resource directory").explicit(),
                PermissionDef.of(ACCREDITATION_WRITE, "Mantener la acreditación de recursos", "Maintain resource accreditation").explicit());
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(VIEWER, MODULE, "Lector", "Viewer", Set.of(ASSETS_VIEW, RESOURCES_VIEW))
                        .describedAs("Ve los assets, sus viajes e indicadores.",
                                "Sees the assets, their trips and indicators."),
                RoleDef.of(MANAGER, MODULE, "Administrador de flota", "Fleet manager",
                                Set.of(ASSETS_VIEW, ASSETS_EDIT, RESOURCES_VIEW, RESOURCES_WRITE, ACCREDITATION_WRITE))
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
