import type { CollaboratorDetailData } from "../types/collaborators.types";
import { collaborators } from "./collaborators-mock-data";

/**
 * Default detail/expedient data shared by all collaborators.
 * Contains ONLY dynamic values that would come from the backend.
 * Static UI config (icons, colors, translation keys) lives in the component layer.
 */
export const defaultCollaboratorDetailData: CollaboratorDetailData = {
  collaboratorId: "default",

  scores: [
    { id: "seguridad", score: 78 },
    { id: "todos", score: 91 },
    { id: "todos", score: 85 },
    { id: "normativo", score: 88 },
    { id: "uso", score: 78 },
    { id: "criticos", score: 78 },
  ],

  monthlyEvolution: [
    { date: "2025-05", score: 68, safety: 62, punctuality: 74, incidents: 5 },
    { date: "2025-06", score: 70, safety: 65, punctuality: 76, incidents: 4 },
    { date: "2025-07", score: 72, safety: 68, punctuality: 78, incidents: 3 },
    { date: "2025-08", score: 71, safety: 66, punctuality: 75, incidents: 4 },
    { date: "2025-09", score: 75, safety: 70, punctuality: 80, incidents: 3 },
    { date: "2025-10", score: 74, safety: 69, punctuality: 78, incidents: 2 },
    { date: "2025-11", score: 78, safety: 74, punctuality: 82, incidents: 2 },
    { date: "2025-12", score: 76, safety: 72, punctuality: 80, incidents: 3 },
    { date: "2026-01", score: 80, safety: 76, punctuality: 85, incidents: 1 },
    { date: "2026-02", score: 79, safety: 75, punctuality: 83, incidents: 2 },
    { date: "2026-03", score: 82, safety: 78, punctuality: 86, incidents: 1 },
    { date: "2026-04", score: 84, safety: 80, punctuality: 88, incidents: 0 },
  ],

  behaviorEvents: [
    {
      title: "Exceso de velocidad moderado detectado (85 km/h en zona 60 km/h)",
      licensePlate: "AB-1234",
      route: "Ruta Santiago - Valparaíso",
      location: "Km 78, Casablanca",
      date: "05/04/2026, 14:32",
      urgency: "warning",
      category: "seguridad",
    },
    {
      title: "Frenada brusca en intersección",
      licensePlate: "AB-1234",
      route: "Ruta Santiago - Valparaíso",
      location: "Km 45, Curacaví",
      date: "05/04/2026, 11:15",
      urgency: "critical",
      category: "seguridad",
    },
    {
      title: "Uso de vehículo fuera de horario laboral",
      licensePlate: "CD-5678",
      route: "Ruta urbana Santiago Centro",
      location: "Av. Libertador Bernardo O'Higgins",
      date: "04/04/2026, 22:45",
      urgency: "warning",
      category: "uso",
    },
    {
      title: "Certificación de manejo defensivo próxima a vencer",
      licensePlate: "—",
      route: "—",
      location: "—",
      date: "03/04/2026, 09:00",
      urgency: "info",
      category: "normativo",
    },
    {
      title: "Exceso de velocidad grave (120 km/h en zona 80 km/h)",
      licensePlate: "AB-1234",
      route: "Autopista del Sol",
      location: "Km 32, Peaje Lo Prado",
      date: "02/04/2026, 16:50",
      urgency: "critical",
      category: "seguridad",
    },
    {
      title: "Desvío de ruta no autorizado",
      licensePlate: "CD-5678",
      route: "Ruta Santiago - Rancagua",
      location: "Salida Buin",
      date: "01/04/2026, 13:20",
      urgency: "warning",
      category: "uso",
    },
    {
      title: "Licencia de conducir renovada exitosamente",
      licensePlate: "—",
      route: "—",
      location: "Municipalidad de Santiago",
      date: "30/03/2026, 10:00",
      urgency: "info",
      category: "normativo",
    },
  ],
};

// ─── Per-collaborator detail data map ─────────────────────────────────
// Uses the collaborator ID as key. Every collaborator gets the same default
// data for now; the backend will provide real per-user data later.

export const collaboratorDetailDataMap: Record<string, CollaboratorDetailData> =
  Object.fromEntries(
    collaborators.map((c) => [
      c.id,
      { ...defaultCollaboratorDetailData, collaboratorId: c.id },
    ])
  );

/**
 * Get detail/expedient data for a single collaborator.
 * Returns undefined when the ID is not found.
 */
export function getCollaboratorDetailData(
  collaboratorId: string
): CollaboratorDetailData | undefined {
  return collaboratorDetailDataMap[collaboratorId];
}
