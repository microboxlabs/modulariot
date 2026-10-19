package com.microboxlabs.miot.core.iam;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/** Organization administration, plus the harness and content roles that core already enforces. */
@ApplicationScoped
public class CoreAccessCatalog implements AccessCatalog {

    public static final String ORG_READ = "org:read";
    public static final String ORG_UPDATE = "org:update";
    public static final String ORG_DELETE = "org:delete";
    public static final String MEMBERS_READ = "members:read";
    public static final String MEMBERS_INVITE = "members:invite";
    public static final String MEMBERS_UPDATE = "members:update";
    public static final String MEMBERS_REMOVE = "members:remove";
    public static final String OWNERS_MANAGE = "owners:manage";
    public static final String TEAMS_MANAGE = "teams:manage";
    public static final String APIKEYS_MANAGE = "apikeys:manage";
    public static final String AUDIT_READ = "audit:read";
    public static final String BILLING_MANAGE = "billing:manage";
    public static final String HARNESS_TRAIN = "harness:train";
    public static final String CONTENT_AUTO_APPROVE = "content:review.autoapprove";

    public static final String HARNESS_TRAINER = "HARNESS_TRAINER";
    public static final String CONTENT_REVIEW_AUTO_APPROVER = "CONTENT_REVIEW_AUTO_APPROVER";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(ORG_READ, "Ver la organización", "View the organization"),
                PermissionDef.of(ORG_UPDATE, "Editar la organización", "Edit the organization"),
                PermissionDef.of(ORG_DELETE, "Eliminar la organización", "Delete the organization").forOwnersOnly(),
                PermissionDef.of(MEMBERS_READ, "Ver miembros", "View members"),
                PermissionDef.of(MEMBERS_INVITE, "Invitar miembros", "Invite members"),
                PermissionDef.of(MEMBERS_UPDATE, "Cambiar roles de miembros", "Change member roles"),
                PermissionDef.of(MEMBERS_REMOVE, "Quitar miembros", "Remove members"),
                PermissionDef.of(OWNERS_MANAGE, "Administrar propietarios", "Manage owners").forOwnersOnly(),
                PermissionDef.of(TEAMS_MANAGE, "Administrar equipos", "Manage teams"),
                PermissionDef.of(APIKEYS_MANAGE, "Administrar claves API", "Manage API keys"),
                PermissionDef.of(AUDIT_READ, "Ver auditoría", "View the audit log"),
                PermissionDef.of(BILLING_MANAGE, "Administrar facturación", "Manage billing").forOwnersOnly(),
                PermissionDef.of(HARNESS_TRAIN, "Entrenar Harness", "Train Harness"),
                PermissionDef.of(CONTENT_AUTO_APPROVE, "Aprobar contenido automáticamente",
                        "Approve content automatically").explicit());
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(HARNESS_TRAINER, "harness", "Entrenador de Harness", "Harness trainer",
                        Set.of(HARNESS_TRAIN))
                        .describedAs("Enseña a Harness: edita su conocimiento y ejecuta evaluaciones.",
                                "Teaches Harness: edits its knowledge and runs evaluations."),
                RoleDef.of(CONTENT_REVIEW_AUTO_APPROVER, "content", "Aprobador automático", "Auto-approver",
                        Set.of(CONTENT_AUTO_APPROVE))
                        .describedAs("Las fotos y documentos que sube se aprueban sin revisión.",
                                "Photos and documents this person uploads are approved without review."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(
                ModuleDef.of("harness", "Harness", "Harness",
                        "El asistente de IA que responde preguntas sobre la operación.",
                        "The AI assistant that answers questions about the operation.").asAi(),
                ModuleDef.of("content", "Revisión de contenido", "Content review",
                        "Revisión de fotos y documentos subidos en terreno.",
                        "Review of photos and documents uploaded in the field."));
    }
}
