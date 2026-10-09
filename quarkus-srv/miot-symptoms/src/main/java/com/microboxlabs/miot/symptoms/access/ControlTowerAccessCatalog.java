package com.microboxlabs.miot.symptoms.access;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.ModuleDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/**
 * The control tower's permissions and roles.
 *
 * <table>
 *   <caption>Roles</caption>
 *   <tr><th>Role</th><th>Permissions</th></tr>
 *   <tr><td>{@value #VIEWER}</td><td>{@value #VIEW}</td></tr>
 *   <tr><td>{@value #OPERATOR}</td><td>+ {@value #CASE_TREAT}, {@value #CONTACT_WRITE}</td></tr>
 *   <tr><td>{@value #MAINTAINER}</td><td>every control tower permission</td></tr>
 * </table>
 *
 * <p>Owners and Admins hold every permission. With Alfresco membership, a member without a control tower role is an
 * Operator, as before the roles existed.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class ControlTowerAccessCatalog implements AccessCatalog {

    public static final String MODULE = "controltower";

    public static final String VIEW = "controltower:view";
    public static final String CASE_TREAT = "controltower:case.treat";
    public static final String CONTACT_WRITE = "controltower:contact.write";
    public static final String CONTACT_DELETE = "controltower:contact.delete";
    public static final String SYMPTOM_EDIT = "controltower:symptom.edit";
    public static final String SYMPTOM_PUBLISH = "controltower:symptom.publish";
    public static final String SETTINGS_UPDATE = "controltower:settings.update";

    public static final String VIEWER = "CONTROL_TOWER_VIEWER";
    public static final String OPERATOR = "CONTROL_TOWER_OPERATOR";
    public static final String MAINTAINER = "CONTROL_TOWER_MAINTAINER";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(VIEW, "Ver la torre de control", "View the control tower"),
                PermissionDef.of(CASE_TREAT, "Tratar casos", "Treat cases"),
                PermissionDef.of(CONTACT_WRITE, "Crear y editar contactos", "Create and edit contacts"),
                PermissionDef.of(CONTACT_DELETE, "Eliminar contactos", "Delete contacts"),
                PermissionDef.of(SYMPTOM_EDIT, "Editar síntomas", "Edit symptoms"),
                PermissionDef.of(SYMPTOM_PUBLISH, "Publicar y activar síntomas", "Publish and switch symptoms"),
                PermissionDef.of(SETTINGS_UPDATE, "Cambiar el equipo de operadores", "Change the operator team"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(VIEWER, MODULE, "Lector", "Viewer", Set.of(VIEW))
                        .describedAs("Ve los casos y síntomas sin cambiar nada.",
                                "Sees cases and symptoms without changing anything."),
                RoleDef.of(OPERATOR, MODULE, "Operador", "Operator", Set.of(VIEW, CASE_TREAT, CONTACT_WRITE))
                        .asLegacyDefault()
                        .describedAs("Atiende los casos y mantiene los contactos.",
                                "Handles cases and keeps contacts up to date."),
                RoleDef.of(MAINTAINER, MODULE, "Mantenedor", "Maintainer", Set.of(VIEW, CASE_TREAT, CONTACT_WRITE,
                        CONTACT_DELETE, SYMPTOM_EDIT, SYMPTOM_PUBLISH, SETTINGS_UPDATE))
                        .describedAs("Además define los síntomas, los publica y configura el equipo de operadores.",
                                "Also defines and publishes symptoms and sets up the operator team."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(ModuleDef.of(MODULE, "Torre de control", "Control tower",
                "Detecta síntomas en los viajes y organiza su atención.",
                "Detects symptoms in trips and organizes how they are handled."));
    }
}
