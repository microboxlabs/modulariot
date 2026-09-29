import "server-only";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import SymptomRulesPageContent from "@/features/settings-admin/components/symptom-rules-page-content";

/**
 * Settings › Reglas de síntomas (PT4-a).
 *
 * Mantenedor F4 portado del laboratorio de autogestión: catálogo por
 * familias con encendido/apagado auditado (torre), esquema de criticidad
 * read-only y auditoría. Para orgs carrier el catálogo es solo lectura y
 * las cuotas del tenant (75/600/9) se muestran arriba. Datos vía
 * /api/atc/rpc/* (PostgREST :3011, atc_dev) con tenant server-side.
 */
export default async function SymptomRulesPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  return (
    <RouteGuard
      path="/users/settings/symptom-rules"
      fallbackPath={`/${lang}/shipping`}
    >
      <SymptomRulesPageContent />
    </RouteGuard>
  );
}
