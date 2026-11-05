package com.microboxlabs.miot.core.iam;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * The coordinator app's permissions and roles: shipping coordination, calendar, dashboards, conversations,
 * collaborators and the admin console. Each role replaces an Alfresco group the app or the ECM workflow used to check.
 *
 * <p>The {@code coordination:stage.*} permissions decide who works a workflow stage, and the {@code admin:*} ones open
 * the admin console. Both are explicit: an organization Owner or Admin holds them only through a role. Completing a
 * task comes only from {@value #KANBAN_USER}, so a stage role can be held without it.
 */
@ApplicationScoped
public class CoordinatorAccessCatalog implements AccessCatalog {

    public static final String ADMIN = "admin";
    public static final String DASHBOARDS = "dashboards";
    public static final String CALENDAR = "calendar";
    public static final String COORDINATION = "coordination";
    public static final String COLLABORATORS = "collaborators";
    public static final String CONVERSATIONS = "conversations";

    public static final String ADMIN_CONSOLE = "admin:console";
    public static final String ADMIN_TASK_UNCLAIM = "admin:task.unclaim";
    public static final String ADMIN_LIVESTREAMS_VIEW = "admin:livestreams.view";
    public static final String DASHBOARDS_VIEW = "dashboards:view";
    public static final String CALENDAR_VIEW = "calendar:view";
    public static final String CALENDAR_PLAN = "calendar:plan";
    public static final String CALENDAR_ASSIGN = "calendar:assign";
    public static final String KANBAN_VIEW = "coordination:kanban.view";
    public static final String LOADS_SEARCH = "coordination:loads.search";
    public static final String TASK_COMPLETE = "coordination:task.complete";
    public static final String FINISHED_VIEW = "coordination:finished.view";
    public static final String REPORTS_VIEW = "coordination:reports.view";
    public static final String GEOGRAPHIC_VIEW = "coordination:geographic.view";
    public static final String STAGE_CONTROL_TOWER = "coordination:stage.control-tower";
    public static final String STAGE_TRANSPORT_VALIDATION = "coordination:stage.transport-validation";
    public static final String STAGE_ESCALATION = "coordination:stage.escalation";
    public static final String STAGE_DELIVERY_REASSIGNMENT = "coordination:stage.delivery-reassignment";
    public static final String COLLABORATORS_MANAGE = "collaborators:manage";
    public static final String CONVERSATIONS_VIEW = "conversations:view";

    public static final String SYSTEM_ADMIN = "SYSTEM_ADMIN";
    public static final String DASHBOARD_VIEWER = "DASHBOARD_VIEWER";
    public static final String CALENDAR_VIEWER = "CALENDAR_VIEWER";
    public static final String CALENDAR_PLANNER = "CALENDAR_PLANNER";
    public static final String CALENDAR_ASSIGNER = "CALENDAR_ASSIGNER";
    public static final String CONTROL_TOWER_EXECUTIVE = "CONTROL_TOWER_EXECUTIVE";
    public static final String TRANSPORT_VALIDATOR = "TRANSPORT_VALIDATOR";
    public static final String TRIP_ESCALATION = "TRIP_ESCALATION";
    public static final String TRANSPORT_EXECUTIVE = "TRANSPORT_EXECUTIVE";
    public static final String KANBAN_USER = "KANBAN_USER";
    public static final String REVIEWER = "REVIEWER";
    public static final String LOAD_SEARCHER = "LOAD_SEARCHER";
    public static final String COLLABORATORS_MANAGER = "COLLABORATORS_MANAGER";
    public static final String CONVERSATIONS_AGENT = "CONVERSATIONS_AGENT";

    private static final Set<String> STAGE_BASE = Set.of(KANBAN_VIEW, FINISHED_VIEW);

    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(ADMIN_CONSOLE, "Usar la consola de administración", "Use the admin console")
                        .explicit(),
                PermissionDef.of(ADMIN_TASK_UNCLAIM, "Liberar tareas tomadas por otros",
                        "Release tasks taken by others").explicit(),
                PermissionDef.of(ADMIN_LIVESTREAMS_VIEW, "Ver transmisiones en vivo", "View live streams")
                        .explicit(),
                PermissionDef.of(DASHBOARDS_VIEW, "Ver tableros", "View dashboards"),
                PermissionDef.of(CALENDAR_VIEW, "Ver el calendario", "View the calendar"),
                PermissionDef.of(CALENDAR_PLAN, "Planificar servicios", "Plan services"),
                PermissionDef.of(CALENDAR_ASSIGN, "Asignar conductor y transporte", "Assign driver and transport"),
                PermissionDef.of(KANBAN_VIEW, "Ver el tablero de envíos", "View the shipping board"),
                PermissionDef.of(LOADS_SEARCH, "Buscar cargas", "Search loads"),
                PermissionDef.of(TASK_COMPLETE, "Completar tareas", "Complete tasks"),
                PermissionDef.of(FINISHED_VIEW, "Ver servicios finalizados", "View finished services"),
                PermissionDef.of(REPORTS_VIEW, "Ver reportes", "View reports"),
                PermissionDef.of(GEOGRAPHIC_VIEW, "Ver la vista geográfica", "View the geographic view"),
                PermissionDef.of(STAGE_CONTROL_TOWER, "Atender las etapas de torre de control",
                        "Work the control tower stages").explicit(),
                PermissionDef.of(STAGE_TRANSPORT_VALIDATION, "Validar transporte", "Validate transport")
                        .explicit(),
                PermissionDef.of(STAGE_ESCALATION, "Atender escalamientos de viaje", "Handle trip escalations")
                        .explicit(),
                PermissionDef.of(STAGE_DELIVERY_REASSIGNMENT, "Recibir entregas reasignadas",
                        "Receive reassigned deliveries").explicit(),
                PermissionDef.of(COLLABORATORS_MANAGE, "Administrar colaboradores", "Manage collaborators"),
                PermissionDef.of(CONVERSATIONS_VIEW, "Ver conversaciones de WhatsApp",
                        "View WhatsApp conversations"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(SYSTEM_ADMIN, ADMIN, "Administrador del sistema", "System administrator",
                        Set.of(ADMIN_CONSOLE, ADMIN_TASK_UNCLAIM, ADMIN_LIVESTREAMS_VIEW))
                        .describedAs("Usa la consola de administración y libera tareas tomadas por otros.",
                                "Uses the admin console and releases tasks taken by others."),
                RoleDef.of(DASHBOARD_VIEWER, DASHBOARDS, "Lector de tableros", "Dashboard viewer",
                        Set.of(DASHBOARDS_VIEW))
                        .describedAs("Ve los tableros que le fueron compartidos.",
                                "Sees the dashboards shared with them."),
                RoleDef.of(CALENDAR_VIEWER, CALENDAR, "Lector", "Viewer", Set.of(CALENDAR_VIEW))
                        .describedAs("Ve el calendario sin cambiar nada.", "Sees the calendar without changing it."),
                RoleDef.of(CALENDAR_PLANNER, CALENDAR, "Planificador", "Planner", Set.of(CALENDAR_VIEW, CALENDAR_PLAN))
                        .describedAs("Planifica servicios en el calendario.", "Plans services on the calendar."),
                RoleDef.of(CALENDAR_ASSIGNER, CALENDAR, "Asignador", "Assigner",
                        Set.of(CALENDAR_VIEW, CALENDAR_ASSIGN))
                        .describedAs("Asigna conductor y transporte a los servicios planificados.",
                                "Assigns driver and transport to planned services."),
                RoleDef.of(CONTROL_TOWER_EXECUTIVE, COORDINATION, "Ejecutivo torre de control",
                        "Control tower executive", union(STAGE_BASE, Set.of(REPORTS_VIEW, GEOGRAPHIC_VIEW,
                                STAGE_CONTROL_TOWER)))
                        .describedAs("Atiende las etapas del viaje, desde la consolidación hasta la entrega.",
                                "Works the trip stages, from consolidation to delivery."),
                RoleDef.of(TRANSPORT_VALIDATOR, COORDINATION, "Validador de transporte", "Transport validator",
                        union(STAGE_BASE, Set.of(STAGE_TRANSPORT_VALIDATION)))
                        .describedAs("Valida al conductor y al transporte presentados.",
                                "Validates the presented driver and transport."),
                RoleDef.of(TRIP_ESCALATION, COORDINATION, "Escalamiento de viajes", "Trip escalation",
                        union(STAGE_BASE, Set.of(STAGE_ESCALATION)))
                        .describedAs("Recibe los viajes que la torre de control escala.",
                                "Receives the trips the control tower escalates."),
                RoleDef.of(TRANSPORT_EXECUTIVE, COORDINATION, "Ejecutivo de transporte", "Transport executive",
                        union(STAGE_BASE, Set.of(STAGE_DELIVERY_REASSIGNMENT)))
                        .describedAs("Recibe las entregas que quedaron sin atender.",
                                "Receives deliveries left unattended."),
                RoleDef.of(KANBAN_USER, COORDINATION, "Usuario del tablero", "Board user",
                        Set.of(KANBAN_VIEW, TASK_COMPLETE, FINISHED_VIEW))
                        .describedAs("Ve el tablero de envíos y completa sus tareas.",
                                "Sees the shipping board and completes their tasks."),
                RoleDef.of(REVIEWER, COORDINATION, "Revisor", "Reviewer", Set.of(KANBAN_VIEW, FINISHED_VIEW))
                        .describedAs("Revisa el tablero de envíos sin completar tareas.",
                                "Reviews the shipping board without completing tasks."),
                RoleDef.of(LOAD_SEARCHER, COORDINATION, "Buscador de cargas", "Load searcher", Set.of(LOADS_SEARCH))
                        .describedAs("Busca dónde está una carga.", "Looks up where a load is."),
                RoleDef.of(COLLABORATORS_MANAGER, COLLABORATORS, "Administrador de colaboradores",
                        "Collaborators manager", Set.of(COLLABORATORS_MANAGE))
                        .describedAs("Administra los colaboradores de la organización.",
                                "Manages the organization's collaborators."),
                RoleDef.of(CONVERSATIONS_AGENT, CONVERSATIONS, "Agente", "Agent", Set.of(CONVERSATIONS_VIEW))
                        .describedAs("Ve las conversaciones de WhatsApp.", "Sees the WhatsApp conversations."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(
                ModuleDef.of(COORDINATION, "Coordinación de envíos", "Shipping coordination",
                        "El flujo de envíos: tablero, tareas y etapas del viaje.",
                        "The shipping flow: board, tasks and trip stages."),
                ModuleDef.of(CALENDAR, "Calendario", "Calendar",
                        "Planificación y asignación de servicios.", "Planning and assignment of services."),
                ModuleDef.of(DASHBOARDS, "Tableros", "Dashboards",
                        "Tableros de indicadores de la operación.", "Operation dashboards."),
                ModuleDef.of(CONVERSATIONS, "Conversaciones", "Conversations",
                        "Conversaciones de WhatsApp con conductores y clientes.",
                        "WhatsApp conversations with drivers and customers."),
                ModuleDef.of(COLLABORATORS, "Colaboradores", "Collaborators",
                        "Colaboradores externos de la organización.", "The organization's external collaborators."),
                ModuleDef.of(ADMIN, "Administración", "Administration",
                        "Consola de administración: registros, plantillas y webhooks.",
                        "Admin console: logs, templates and webhooks."));
    }

    private static Set<String> union(Set<String> a, Set<String> b) {
        Set<String> all = new TreeSet<>(a);
        all.addAll(b);
        return Set.copyOf(all);
    }
}
