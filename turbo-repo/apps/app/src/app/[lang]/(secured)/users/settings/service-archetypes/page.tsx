import "server-only";
import ServiceArchetypesPageContent from "@/features/settings-admin/components/service-archetypes-page-content";

/**
 * Settings › Arquetipos de servicio (capacity-core C1.5).
 * El molde de la UO: composición y requisitos por tipo de servicio.
 * Torre define (v1); los carriers los consumen desde el Desk.
 */
export default async function ServiceArchetypesPage() {
  return <ServiceArchetypesPageContent />;
}
